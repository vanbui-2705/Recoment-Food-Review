import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { hashPassword } from "../../src/common/security/password.js";
import { createMerchantService } from "../../src/modules/merchant-menu/merchant.service.js";
import { createMenuSyncService } from "../../src/modules/merchant-menu/menu-sync.service.js";
import type { MenuSyncAdapter } from "../../src/modules/merchant-menu/menu-sync.adapters.js";

describe("durable authorized menu synchronization", () => {
  const suffix = randomUUID();
  let failPage = true,
    pausePage = false,
    supplierId = "",
    dishId = "",
    restaurantId = "";
  const manifest = {
    snapshotId: "immutable-test-snapshot",
    observedAt: new Date().toISOString(),
    expectedPages: 2,
    mode: "COMPLETE" as const,
  };
  const row = (externalId: string, price: number) => ({
    restaurant: {
      externalId: "venue",
      name: `Venue ${suffix}`,
      address: "Synthetic",
      latitude: 10.77,
      longitude: 106.7,
    },
    externalId,
    title: `Sync ${suffix}`,
    price,
    currency: "VND",
    isAvailable: true,
    sourceUrl: "https://supplier.test/menu",
    observedAt: manifest.observedAt,
    expiresAt: new Date(Date.parse(manifest.observedAt) + 3600000).toISOString(),
  });
  const adapter: MenuSyncAdapter = {
    configured: true,
    snapshot: async () => manifest,
    page: async (_supplier, _manifest, page) => {
      if (page === 1 && failPage) {
        failPage = false;
        throw new Error("private supplier credentials must not leak");
      }
      if (pausePage)
        await app.prisma.menuSyncSchedule.update({
          where: { supplierId },
          data: { enabled: false },
        });
      return [row(page === 0 ? "regular" : "small", page === 0 ? 45000 : 30000)];
    },
  };
  const registry = new Map([["fixture", adapter]]),
    app = buildApp({ logger: false, menuAdapters: registry, menuSyncEnabled: true }),
    ids: string[] = [];
  let admin: { authorization: string }, user: { authorization: string };
  beforeAll(async () => {
    await app.ready();
    const passwordHash = await hashPassword("sync-test-password");
    for (const role of ["ADMIN", "USER"] as const) {
      const email = `sync-${role.toLowerCase()}-${suffix}@test.local`,
        created = await app.prisma.user.create({
          data: { email, displayName: "Sync", passwordHash, role },
        });
      ids.push(created.id);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "sync-test-password" },
      });
      expect(login.statusCode).toBe(200);
      const headers = { authorization: `Bearer ${login.json().data.accessToken}` };
      if (role === "ADMIN") admin = headers;
      else user = headers;
    }
    const cuisine = await app.prisma.cuisine.findFirstOrThrow();
    dishId = (
      await app.prisma.dish.create({
        data: {
          slug: `sync-${suffix}`,
          name: `Sync ${suffix}`,
          cuisineId: cuisine.id,
          priceMin: 10000,
          priceMax: 50000,
          spicyLevel: 0,
          sweetLevel: 0,
          sourLevel: 0,
          saltyLevel: 0,
        },
      })
    ).id;
    supplierId = (
      await app.prisma.merchantSupplier.create({
        data: {
          code: `sync-${suffix}`,
          name: "Synthetic authorized supplier",
          documentationUrl: "https://supplier.test/docs",
          authorizationReference: "synthetic-contract",
          enabled: true,
        },
      })
    ).id;
    const merchant = createMerchantService(app.prisma),
      run = await merchant.start(
        {
          supplierId,
          snapshotId: "baseline",
          observedAt: new Date(Date.now() - 60000).toISOString(),
          mode: "COMPLETE",
          expectedPages: 1,
        },
        ids[0]!,
      );
    await merchant.stage(run.id, 0, [row("regular", 35000)], ids[0]!);
    await merchant.commit(run.id, ids[0]!);
    restaurantId = (
      await app.prisma.externalRestaurantIdentity.findFirstOrThrow({ where: { supplierId } })
    ).restaurantId;
  });
  afterAll(async () => {
    await app.prisma.menuSyncJob.deleteMany({ where: { scheduleId: supplierId } });
    await app.prisma.menuSyncSchedule.deleteMany({ where: { supplierId } });
    await app.prisma.externalMenuItem.deleteMany({ where: { identity: { supplierId } } });
    await app.prisma.externalRestaurantIdentity.deleteMany({ where: { supplierId } });
    await app.prisma.menuSyncRun.deleteMany({ where: { supplierId } });
    await app.prisma.merchantSupplier.deleteMany({ where: { id: supplierId } });
    await app.prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await app.prisma.dish.deleteMany({ where: { id: dishId } });
    await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });
  it("rejects USER writes, missing adapters and stale schedule versions", async () => {
    const payload = {
      adapterCode: "fixture",
      enabled: true,
      intervalMinutes: 5,
      expectedUpdatedAt: null,
    };
    for (const url of ["/admin/menu/schedules", "/admin/menu/sync-jobs"])
      expect((await app.inject({ url, headers: user })).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/menu/schedules/${supplierId}`,
          headers: user,
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/menu/schedules/${supplierId}/run`,
          headers: user,
          payload: { confirm: true, idempotencyKey: randomUUID() },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/menu/sync-jobs/${randomUUID()}/retry`,
          headers: user,
          payload: { confirm: true, expectedUpdatedAt: new Date().toISOString() },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/menu/schedules/${supplierId}`,
          headers: admin,
          payload: { ...payload, adapterCode: "unregistered" },
        })
      ).statusCode,
    ).toBe(503);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/menu/schedules/${supplierId}`,
          headers: admin,
          payload,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/menu/schedules/${supplierId}`,
          headers: admin,
          payload,
        })
      ).statusCode,
    ).toBe(409);
    expect((await app.inject({ url: "/admin/menu/sync-jobs", headers: admin })).body).not.toMatch(
      /manifest|leaseToken|private supplier/,
    );
  });
  it("database rejects partial or missing leases in every job state", async () => {
    await expect(
      app.prisma.menuSyncJob.create({
        data: { scheduleId: supplierId, idempotencyKey: randomUUID(), leaseToken: randomUUID() },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.menuSyncJob.create({
        data: { scheduleId: supplierId, idempotencyKey: randomUUID(), status: "RUNNING" },
      }),
    ).rejects.toThrow();
    expect(await app.prisma.menuSyncJob.count({ where: { scheduleId: supplierId } })).toBe(0);
  });
  it("deduplicates schedule replicas and resumes an expired lease without replacing a partial menu", async () => {
    const service = createMenuSyncService(app.prisma, registry, true),
      now = new Date();
    expect(
      (await Promise.all([service.schedule(now), service.schedule(now)])).reduce(
        (a, b) => a + b,
        0,
      ),
    ).toBe(1);
    expect(await app.prisma.menuSyncJob.count({ where: { scheduleId: supplierId } })).toBe(1);
    expect(await service.tick(now, supplierId)).toBe(true);
    expect(
      (
        await app.prisma.externalMenuItem.findFirstOrThrow({
          where: { identity: { supplierId }, externalId: "regular" },
        })
      ).price,
    ).toBe(35000);
    const job = await app.prisma.menuSyncJob.findFirstOrThrow({
      where: { scheduleId: supplierId },
    });
    expect(job.status).toBe("QUEUED");
    expect(job.errorCode).toBe("MENU_SYNC_UNAVAILABLE");
    const expiredToken = randomUUID();
    await app.prisma.menuSyncJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        leaseToken: expiredToken,
        leaseUntil: new Date(Date.now() - 1000),
      },
    });
    await expect(
      createMerchantService(app.prisma).commit(job.runId!, null, {
        jobId: job.id,
        leaseToken: expiredToken,
      }),
    ).rejects.toMatchObject({ code: "MENU_SYNC_LEASE_LOST" });
    expect(await service.tick(new Date(Date.now() + 10000), supplierId)).toBe(true);
    expect(await app.prisma.menuSyncJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject(
      { status: "SUCCEEDED", attempts: 2, leaseToken: null },
    );
    expect(
      (
        await app.prisma.externalMenuItem.findFirstOrThrow({
          where: { identity: { supplierId }, externalId: "regular" },
        })
      ).price,
    ).toBe(45000);
    expect(
      await app.prisma.externalMenuItem.count({
        where: { identity: { supplierId }, active: true },
      }),
    ).toBe(2);
  });
  it("manual retry is audited CAS, same job request is idempotent and pause fences late writes", async () => {
    const payload = { confirm: true, idempotencyKey: randomUUID() },
      url = `/admin/menu/schedules/${supplierId}/run`;
    const first = await app.inject({ method: "POST", url, headers: admin, payload });
    expect(first.statusCode).toBe(202);
    const id = first.json().data.id;
    expect(
      (await app.inject({ method: "POST", url, headers: admin, payload })).json().data.id,
    ).toBe(id);
    const failed = await app.prisma.menuSyncJob.update({
      where: { id },
      data: { status: "FAILED", attempts: 5, errorCode: "MENU_SYNC_INTERRUPTED", retryable: true },
    });
    const results = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: "POST",
          url: `/admin/menu/sync-jobs/${id}/retry`,
          headers: admin,
          payload: { confirm: true, expectedUpdatedAt: failed.updatedAt.toISOString() },
        }),
      ),
    );
    expect(results.map((value) => value.statusCode).sort()).toEqual([200, 409]);
    expect(
      await app.prisma.adminAudit.count({ where: { targetId: id, action: "MENU_SYNC_RETRY" } }),
    ).toBe(1);
    pausePage = true;
    expect(
      await createMenuSyncService(app.prisma, registry, true).tick(new Date(), supplierId),
    ).toBe(true);
    expect(await app.prisma.menuSyncJob.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "FAILED",
      retryable: false,
      errorCode: "MENU_SYNC_PAUSED",
    });
    expect(
      (
        await app.prisma.externalMenuItem.findFirstOrThrow({
          where: { identity: { supplierId }, externalId: "regular" },
        })
      ).price,
    ).toBe(45000);
  });
});
