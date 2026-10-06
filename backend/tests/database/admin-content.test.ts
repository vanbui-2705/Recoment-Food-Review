import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { hashPassword } from "../../src/common/security/password.js";
import { createFoodService } from "../../src/modules/food/food.service.js";

describe("content moderation preserves identity and history", () => {
  const app = buildApp({ logger: false, database: true }),
    suffix = randomUUID();
  const ids: string[] = [];
  let admin: { authorization: string },
    user: { authorization: string },
    userId: string,
    dishId: string,
    cuisineId: string;
  beforeAll(async () => {
    await app.ready();
    const passwordHash = await hashPassword("content-test-password");
    for (const role of ["ADMIN", "USER"] as const) {
      const email = `content-${role.toLowerCase()}-${suffix}@test.local`;
      const row = await app.prisma.user.create({
        data: { email, displayName: "Content test", role, passwordHash },
      });
      ids.push(row.id);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "content-test-password" },
      });
      expect(login.statusCode).toBe(200);
      const headers = { authorization: `Bearer ${login.json().data.accessToken}` };
      if (role === "ADMIN") admin = headers;
      else {
        user = headers;
        userId = row.id;
      }
    }
    const cuisine = await app.prisma.cuisine.create({
      data: { code: `CT_${suffix.replaceAll("-", "").toUpperCase()}`, name: `Cuisine ${suffix}` },
    });
    cuisineId = cuisine.id;
    const dish = await app.prisma.dish.create({
      data: {
        slug: `content-${suffix}`,
        name: `Content ${suffix}`,
        description: "Test",
        cuisineId,
        priceMin: 10000,
        priceMax: 20000,
        spicyLevel: 0,
        sweetLevel: 0,
        sourLevel: 0,
        saltyLevel: 0,
      },
    });
    dishId = dish.id;
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
    if (dishId) await app.prisma.dish.delete({ where: { id: dishId } });
    if (cuisineId) await app.prisma.cuisine.delete({ where: { id: cuisineId } });
    await app.close();
  });
  async function current() {
    return (await app.inject({ url: `/admin/content/dishes/${dishId}`, headers: admin })).json()
      .data;
  }
  it("protects all catalog kinds and rejects unknown writes", async () => {
    for (const kind of ["dishes", "restaurants", "offers", "cuisines", "ingredients"]) {
      expect((await app.inject({ url: `/admin/content/${kind}`, headers: user })).statusCode).toBe(
        403,
      );
      expect(
        (await app.inject({ url: `/admin/content/${kind}/${dishId}`, headers: user })).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "PUT",
            url: `/admin/content/${kind}/${dishId}/status`,
            headers: user,
            payload: {
              confirm: true,
              isActive: false,
              expectedUpdatedAt: new Date().toISOString(),
              reasonCode: "DATA_REVIEW",
            },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "PUT",
            url: `/admin/content/${kind}/${dishId}/label`,
            headers: user,
            payload: { name: "Changed", expectedUpdatedAt: new Date().toISOString() },
          })
        ).statusCode,
      ).toBe(403);
    }
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/content/ingredients",
          headers: user,
          payload: { code: "XX", name: "Test" },
        })
      ).statusCode,
    ).toBe(403);
    const list = await app.inject({
      url: `/admin/content/dishes?q=${suffix}&limit=1`,
      headers: admin,
    });
    expect(list.json().data.total).toBe(1);
    expect(list.headers["cache-control"]).toBe("no-store");
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/content/dishes/${dishId}/status`,
          headers: admin,
          payload: {
            confirm: true,
            isActive: false,
            expectedUpdatedAt: (await current()).updatedAt,
            reasonCode: "DATA_REVIEW",
            price: 1,
          },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("concurrent moderation has one winner and keeps factual history plus replay", async () => {
    const service = createFoodService(app.prisma),
      key = randomUUID();
    const receipt = await service.record(userId, dishId, "CHOSEN", key);
    const payload = {
      confirm: true,
      isActive: false,
      expectedUpdatedAt: (await current()).updatedAt,
      reasonCode: "DATA_REVIEW",
    };
    const responses = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: "PUT",
          url: `/admin/content/dishes/${dishId}/status`,
          headers: admin,
          payload,
        }),
      ),
    );
    expect(responses.map((row) => row.statusCode).sort()).toEqual([200, 409]);
    expect(
      await app.prisma.adminAudit.count({
        where: { targetId: dishId, action: "CONTENT_STATUS_REVIEW" },
      }),
    ).toBe(1);
    expect((await service.record(userId, dishId, "CHOSEN", key)).id).toBe(receipt.id);
    await expect(service.record(userId, dishId, "CHOSEN", randomUUID())).rejects.toMatchObject({
      code: "DISH_UNAVAILABLE",
    });
    await service.record(userId, dishId, "EATEN", randomUUID());
    expect(await app.prisma.userInteraction.count({ where: { userId, dishId } })).toBe(2);
    expect(
      (await app.inject({ url: `/dishes?q=${suffix}`, headers: user })).json().data.items,
    ).toHaveLength(0);
    expect(
      (await app.inject({ url: `/dishes/${dishId}`, headers: user })).json().data.dish.isActive,
    ).toBe(false);
  });
  it("rejects stale labels and cuisine pause still gates an enabled dish", async () => {
    const row = await current();
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/content/dishes/${dishId}/label`,
          headers: admin,
          payload: { name: "New label", expectedUpdatedAt: row.updatedAt },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/content/dishes/${dishId}/label`,
          headers: admin,
          payload: { name: "Overwritten", expectedUpdatedAt: row.updatedAt },
        })
      ).statusCode,
    ).toBe(409);
    await app.prisma.dish.update({ where: { id: dishId }, data: { isActive: true } });
    const cuisine = await app.prisma.cuisine.findUniqueOrThrow({ where: { id: cuisineId } });
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/content/cuisines/${cuisineId}/status`,
          headers: admin,
          payload: {
            confirm: true,
            isActive: false,
            expectedUpdatedAt: cuisine.updatedAt.toISOString(),
            reasonCode: "SOURCE_REVIEW",
          },
        })
      ).statusCode,
    ).toBe(200);
    await expect(
      createFoodService(app.prisma).record(userId, dishId, "CHOSEN", randomUUID()),
    ).rejects.toMatchObject({ code: "DISH_UNAVAILABLE" });
  });
});
