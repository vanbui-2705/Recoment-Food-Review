import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createMerchantService } from "../../src/modules/merchant-menu/merchant.service.js";
describe("merchant menu transactional ingestion", () => {
  const app = buildApp({ logger: false });
  const tag = randomUUID();
  const emails = [`merchant-${tag}@test.local`, `merchant-user-${tag}@test.local`];
  let adminId: string, supplierId: string, restaurantId: string, dishId: string, offerId: string;
  let admin: { authorization: string }, user: { authorization: string };
  const observed = new Date(Date.now() - 60000).toISOString(),
    expires = new Date(Date.now() + 3600000).toISOString();
  const row = (externalId = "regular") => ({
    restaurant: {
      externalId: "restaurant1",
      name: `Merchant ${tag}`,
      address: "Test address",
      latitude: 10.77,
      longitude: 106.7,
    },
    externalId,
    title: `Canonical ${tag}`,
    optionLabel: externalId,
    price: 45000,
    currency: "VND",
    isAvailable: true,
    sourceUrl: "https://supplier.test/menu",
    observedAt: observed,
    expiresAt: expires,
  });
  let service: ReturnType<typeof createMerchantService>;
  const start = (
    snapshotId: string,
    expectedPages = 1,
    mode: "DELTA" | "COMPLETE" = "DELTA",
    observedAt = observed,
  ) => service.start({ supplierId, snapshotId, expectedPages, mode, observedAt }, adminId);
  beforeAll(async () => {
    await app.ready();
    service = createMerchantService(app.prisma);
    const sessions = [];
    for (const email of emails) {
      const registered = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "merchant-test-password", displayName: "Menu Test" },
      });
      expect(registered.statusCode).toBe(201);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "merchant-test-password" },
      });
      sessions.push({
        id: registered.json().data.user.id,
        headers: { authorization: `Bearer ${login.json().data.accessToken}` },
      });
    }
    adminId = sessions[0]!.id;
    admin = sessions[0]!.headers;
    user = sessions[1]!.headers;
    await app.prisma.user.update({ where: { id: adminId }, data: { role: "ADMIN" } });
    const cuisine = await app.prisma.cuisine.findFirstOrThrow();
    const dish = await app.prisma.dish.create({
      data: {
        slug: `merchant-${tag}`,
        name: `Canonical ${tag}`,
        cuisineId: cuisine.id,
        priceMin: 40000,
        priceMax: 60000,
        spicyLevel: 20,
        sweetLevel: 20,
        saltyLevel: 20,
        sourLevel: 20,
      },
    });
    dishId = dish.id;
    const response = await app.inject({
      method: "PUT",
      url: "/admin/menu/suppliers",
      headers: admin,
      payload: {
        code: `test-${tag}`,
        name: "Authorized test supplier",
        documentationUrl: "https://supplier.test/docs",
        authorizationReference: "Test-only fixture",
        maxEvidenceAgeHours: 24,
        enabled: true,
      },
    });
    expect(response.statusCode).toBe(200);
    supplierId = response.json().data.supplier.id;
  });
  afterAll(async () => {
    const identities = await app.prisma.externalRestaurantIdentity.findMany({
      where: { supplierId },
      select: { id: true, restaurantId: true },
    });
    const offers = await app.prisma.externalMenuItem.findMany({
      where: { identityId: { in: identities.map((i) => i.id) } },
      select: { id: true },
    });
    await app.prisma.evidenceReview.deleteMany({
      where: { evidence: { offerId: { in: offers.map((o) => o.id) } } },
    });
    await app.prisma.offerSafetyEvidence.deleteMany({
      where: { offerId: { in: offers.map((o) => o.id) } },
    });
    await app.prisma.externalMenuItem.deleteMany({
      where: { id: { in: offers.map((o) => o.id) } },
    });
    await app.prisma.externalRestaurantIdentity.deleteMany({ where: { supplierId } });
    await app.prisma.menuSyncRun.deleteMany({ where: { supplierId } });
    await app.prisma.merchantSupplier.deleteMany({ where: { id: supplierId } });
    await app.prisma.restaurant.deleteMany({
      where: { id: { in: identities.map((i) => i.restaurantId) } },
    });
    await app.prisma.dish.deleteMany({ where: { id: dishId } });
    await app.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });
  it("denies non-admin ingestion and validates preview without mutation", async () => {
    expect((await app.inject({ url: "/admin/menu/suppliers" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/admin/menu/suppliers", headers: user })).statusCode).toBe(
      403,
    );
    const preview = await service.preview(supplierId, [
      row(),
      { ...row(), currency: "USD" },
      { ...row(), sourceUrl: "https://supplier.test/?key=do-not-store" },
    ]);
    expect(preview[0]).toMatchObject({ valid: true, dishId });
    expect(preview[1]).toMatchObject({ valid: false });
    expect(await app.prisma.externalMenuItem.count({ where: { identity: { supplierId } } })).toBe(
      0,
    );
  });
  it("replays page/commit idempotently and preserves distinct sizes", async () => {
    const run = await start("initial", 1, "COMPLETE");
    await service.stage(run.id, 0, [row(), row("large")], adminId);
    expect((await service.stage(run.id, 0, [row(), row("large")], adminId)).replayed).toBe(true);
    await expect(service.stage(run.id, 0, [row()], adminId)).rejects.toMatchObject({
      code: "SYNC_PAGE_CONFLICT",
    });
    await service.commit(run.id, adminId);
    expect((await service.commit(run.id, adminId)).replayed).toBe(true);
    const offers = await app.prisma.externalMenuItem.findMany({
      where: { identity: { supplierId } },
      include: { identity: true },
    });
    expect(offers).toHaveLength(2);
    expect(offers.every((o) => o.dishId === dishId)).toBe(true);
    offerId = offers.find((o) => o.externalId === "regular")!.id;
    restaurantId = offers[0]!.identity.restaurantId;
  });
  it("never removes prior offers after partial pages or quarantined data", async () => {
    const run = await start(
      "partial",
      2,
      "COMPLETE",
      new Date(+new Date(observed) + 1000).toISOString(),
    );
    await service.stage(run.id, 0, [{ ...row(), price: -1 }], adminId);
    await expect(service.commit(run.id, adminId)).rejects.toMatchObject({
      code: "SYNC_INCOMPLETE",
    });
    expect(
      await app.prisma.externalMenuItem.count({
        where: { identity: { supplierId }, isAvailable: true },
      }),
    ).toBe(2);
    const quarantine = await app.prisma.menuQuarantine.findMany({ where: { runId: run.id } });
    expect(quarantine).toHaveLength(1);
    expect(quarantine[0]).not.toHaveProperty("payload");
  });
  it("rejects conflicting duplicate identities atomically with no success audit", async () => {
    const run = await start(
      "duplicate",
      1,
      "COMPLETE",
      new Date(+new Date(observed) + 2000).toISOString(),
    );
    await service.stage(run.id, 0, [row(), row()], adminId);
    await expect(service.commit(run.id, adminId)).rejects.toMatchObject({
      code: "DUPLICATE_OFFER",
    });
    expect(
      await app.prisma.adminAudit.count({
        where: { targetId: run.id, action: "MENU_SYNC_COMMITTED" },
      }),
    ).toBe(0);
    expect(
      await app.prisma.externalMenuItem.count({
        where: { identity: { supplierId }, isAvailable: true },
      }),
    ).toBe(2);
  });
  it("keeps missing offers on delta, removes them only on complete and rejects stale snapshots", async () => {
    const delta = await start(
      "delta",
      1,
      "DELTA",
      new Date(+new Date(observed) + 3000).toISOString(),
    );
    await service.stage(delta.id, 0, [row()], adminId);
    await service.commit(delta.id, adminId);
    expect(
      await app.prisma.externalMenuItem.count({
        where: { identity: { supplierId }, isAvailable: true },
      }),
    ).toBe(2);
    const complete = await start(
      "complete",
      1,
      "COMPLETE",
      new Date(+new Date(observed) + 4000).toISOString(),
    );
    await service.stage(complete.id, 0, [row()], adminId);
    await service.commit(complete.id, adminId);
    expect(
      await app.prisma.externalMenuItem.count({
        where: { identity: { supplierId }, isAvailable: true },
      }),
    ).toBe(1);
    const stale = await start("stale");
    await service.stage(stale.id, 0, [row()], adminId);
    await expect(service.commit(stale.id, adminId)).rejects.toMatchObject({ code: "SYNC_STALE" });
  });
  it("marks unknown mappings pending and leaves cross-source ambiguity for admin review", async () => {
    const unrelated = await service.preview(supplierId, [{ ...row(), title: "Unknown food 987" }]);
    expect(unrelated[0]).toMatchObject({ valid: true, dishId: null });
    await app.prisma.dishAlias.create({
      data: { dishId, alias: `Ambiguous ${tag}`, normalizedAlias: `ambiguous ${tag}` },
    });
    const other = await app.prisma.dish.findFirstOrThrow({ where: { id: { not: dishId } } });
    const alias = await app.prisma.dishAlias.create({
      data: { dishId: other.id, alias: `Ambiguous ${tag}`, normalizedAlias: `ambiguous ${tag}` },
    });
    try {
      const preview = await service.preview(supplierId, [{ ...row(), title: `Ambiguous ${tag}` }]);
      expect(preview[0]).toMatchObject({ dishId: null });
    } finally {
      await app.prisma.dishAlias.delete({ where: { id: alias.id } });
    }
  });
  it("paginates authenticated menus and hides expired price instead of presenting it as confirmed", async () => {
    const detail = await app.inject({
      url: `/restaurants/${restaurantId}?limit=1&budget=50000`,
      headers: user,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.menu.items).toHaveLength(1);
    expect(detail.json().data.restaurant).toMatchObject({ rating: null, mediaKind: "VENUE" });
    await app.prisma.externalMenuItem.update({
      where: { id: offerId },
      data: {
        observedAt: new Date(Date.now() - 7200000),
        expiresAt: new Date(Date.now() - 3600000),
      },
    });
    const fresh = await app.inject({ url: `/restaurants/${restaurantId}`, headers: user });
    expect(
      fresh.json().data.menu.items.find((o: { id: string }) => o.id === offerId),
    ).toMatchObject({ price: null, fresh: false, budgetVerified: false });
    await app.prisma.externalMenuItem.update({
      where: { id: offerId },
      data: { observedAt: new Date(observed), expiresAt: new Date(expires) },
    });
  });
  it("requires evidence review, preserves review history and denies revoked reapproval", async () => {
    const allergen = await app.prisma.allergen.findFirstOrThrow();
    const payload = {
      kind: "ALLERGEN",
      code: allergen.code,
      claim: "ABSENT",
      sourceUrl: "https://supplier.test/ingredients",
      excerpt: "Explicit supplier evidence fixture",
      observedAt: observed,
      expiresAt: expires,
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/menu/offers/${offerId}/evidence`,
          headers: user,
          payload,
        })
      ).statusCode,
    ).toBe(403);
    const created = await app.inject({
      method: "POST",
      url: `/admin/menu/offers/${offerId}/evidence`,
      headers: admin,
      payload,
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.evidence.id;
    const review = (status: string, expectedStatus: string) =>
      app.inject({
        method: "POST",
        url: `/admin/menu/evidence/${id}/review`,
        headers: admin,
        payload: { status, expectedStatus, reason: "Reviewed source fixture" },
      });
    expect((await review("APPROVED", "PENDING")).statusCode).toBe(200);
    expect((await review("REVOKED", "APPROVED")).statusCode).toBe(200);
    expect((await review("APPROVED", "REVOKED")).statusCode).toBe(409);
    expect(await app.prisma.evidenceReview.count({ where: { evidenceId: id } })).toBe(2);
  });
  it("keeps audit immutable and redacted", async () => {
    const event = await app.prisma.adminAudit.findFirstOrThrow({ where: { actorId: adminId } });
    await expect(
      app.prisma.adminAudit.update({
        where: { id: event.id },
        data: { metadata: { altered: true } },
      }),
    ).rejects.toThrow();
    expect(JSON.stringify(event.metadata)).not.toContain("password");
    expect(JSON.stringify(event.metadata)).not.toContain("sourceUrl");
  });
});
