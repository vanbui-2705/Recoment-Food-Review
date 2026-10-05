import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createFoodService } from "../../src/modules/food/food.service.js";
import { REPEAT_WINDOW_MS } from "../../src/modules/food/food.policy.js";

describe("food discovery persistence", () => {
  const app = buildApp({ logger: false });
  const suffix = randomUUID();
  let userId = "";
  let dishId = "";
  let adminId = "";
  let headers: { authorization: string };
  let otherHeaders: { authorization: string };
  let adminHeaders: { authorization: string };
  const emails = [
    `food-${suffix}@test.local`,
    `other-${suffix}@test.local`,
    `admin-${suffix}@test.local`,
  ];
  async function session(email: string) {
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "food-test-password", displayName: "Food User" },
    });
    expect(registered.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "food-test-password" },
    });
    expect(login.statusCode).toBe(200);
    return {
      id: registered.json().data.user.id as string,
      headers: { authorization: `Bearer ${login.json().data.accessToken}` },
    };
  }
  const payload = {
    spicyLevel: 20,
    sweetLevel: 20,
    sourLevel: 20,
    saltyLevel: 20,
    budgetMin: 0,
    budgetMax: 100000,
    maxDistanceMeters: 3000,
    latitude: 10.77,
    longitude: 106.7,
    areaLabel: "Test area",
    mealPeriod: "LUNCH",
    allergies: [],
    dietaryRestrictions: [],
    cuisinePreferences: [],
  };
  const dish = {
    slug: `test-${suffix}`,
    name: `Test dish ${suffix}`,
    description: "Test recipe",
    cuisineCode: "VIETNAMESE",
    priceMin: 30000,
    priceMax: 60000,
    spicyLevel: 20,
    sweetLevel: 20,
    sourLevel: 20,
    saltyLevel: 20,
    verificationStatus: "REVIEWED",
    evidenceSource: "Test recipe source",
    dietaryCodes: [],
    mealPeriods: ["LUNCH"],
    aliases: ["Test alias"],
    ingredientCodes: ["RICE"],
    allergens: [{ code: "FISH", presence: "MAY_CONTAIN" }],
  };
  beforeAll(async () => {
    await app.ready();
    const a = await session(emails[0]!);
    userId = a.id;
    headers = a.headers;
    otherHeaders = (await session(emails[1]!)).headers;
    const admin = await session(emails[2]!);
    adminId = admin.id;
    adminHeaders = admin.headers;
    await app.prisma.user.update({ where: { id: adminId }, data: { role: "ADMIN" } });
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: emails } } });
    if (dishId) await app.prisma.dish.delete({ where: { id: dishId } });
    await app.close();
  });
  it("protects admin writes and validates catalog references atomically", async () => {
    expect((await app.inject({ url: "/recommendations/today" })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "POST", url: "/admin/dishes", headers, payload: dish }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/dishes",
          headers: adminHeaders,
          payload: { ...dish, ingredientCodes: ["NOT_REAL"] },
        })
      ).statusCode,
    ).toBe(400);
    const created = await app.inject({
      method: "POST",
      url: "/admin/dishes",
      headers: adminHeaders,
      payload: dish,
    });
    expect(created.statusCode).toBe(201);
    dishId = created.json().data.dish.id;
    const invalid = await app.inject({
      method: "PUT",
      url: `/admin/dishes/${dishId}`,
      headers: adminHeaders,
      payload: { ...dish, aliases: ["Bún đậu", "bun dau"] },
    });
    expect(invalid.statusCode).toBe(400);
    const read = await app.inject({ url: `/dishes/${dishId}`, headers });
    expect(read.json().data.dish.aliases).toHaveLength(1);
    expect(
      (await app.inject({ url: "/dishes?q=test%20alias", headers }))
        .json()
        .data.items.some((d: { id: string }) => d.id === dishId),
    ).toBe(true);
  });
  it("persists complete profile, excludes chosen dishes immediately and isolates users", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/users/me/onboarding",
          headers,
          payload: { ...payload, longitude: null },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ method: "POST", url: "/users/me/onboarding", headers, payload }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: "/users/me/profile", headers })).json().data.profile,
    ).toMatchObject({ latitude: payload.latitude, mealPeriod: "LUNCH" });
    const key = randomUUID();
    const url = `/users/me/dishes/${dishId}/interactions`;
    const first = await app.inject({
      method: "POST",
      url,
      headers,
      payload: { type: "CHOSEN", idempotencyKey: key },
    });
    const retry = await app.inject({
      method: "POST",
      url,
      headers,
      payload: { type: "CHOSEN", idempotencyKey: key },
    });
    expect(first.statusCode).toBe(200);
    expect(retry.json().data.id).toBe(first.json().data.id);
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          headers,
          payload: { type: "EATEN", idempotencyKey: key },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await app.inject({ url: "/users/me/food-history", headers: otherHeaders })).json().data
        .items,
    ).toHaveLength(0);
    const service = createFoodService(app.prisma);
    const actionAt = new Date(first.json().data.createdAt).getTime();
    expect(
      (await service.today(userId, new Date(actionAt + REPEAT_WINDOW_MS - 1))).items.some(
        (d) => d.id === dishId,
      ),
    ).toBe(false);
    expect(
      (await service.today(userId, new Date(actionAt + REPEAT_WINDOW_MS))).items.some(
        (d) => d.id === dishId,
      ),
    ).toBe(true);
  });
  it("persists yesterday's meal and permanent dislikes without relaxing safety", async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/users/me/dishes/${dishId}/interactions`,
          headers,
          payload: { type: "EATEN", idempotencyKey: randomUUID(), eatenAt: yesterday },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/users/me/dishes/${dishId}/interactions`,
          headers,
          payload: {
            type: "EATEN",
            idempotencyKey: randomUUID(),
            eatenAt: new Date(Date.now() + 86400000).toISOString(),
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/users/me/dishes/${dishId}/preference`,
          headers,
          payload: { preference: "DISLIKED" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await createFoodService(app.prisma).today(
          userId,
          new Date(Date.now() + REPEAT_WINDOW_MS + 1000),
        )
      ).items.some((d) => d.id === dishId),
    ).toBe(false);
    await app.inject({
      method: "PUT",
      url: "/users/me/profile",
      headers,
      payload: { ...payload, allergies: [{ code: "FISH", severity: "SEVERE", notes: null }] },
    });
    const safe = await app.inject({ url: "/recommendations/today", headers });
    expect(safe.json().data.status).toBe("INSUFFICIENT_SAFETY_DATA");
    expect(safe.json().data.items).toHaveLength(0);
  });
});
