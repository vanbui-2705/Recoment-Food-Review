import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { createDiscoveryService } from "../../src/modules/discovery/discovery.service.js";
import { REPEAT_WINDOW_MS } from "../../src/modules/food/food.policy.js";
const meal = {
  idMeal: "12",
  strMeal: "Test external soup",
  strInstructions: "Boil water\nCook",
  strIngredient1: "water",
};
describe("external discovery persistence and authorization", () => {
  const app = buildApp({ logger: false });
  const email = `external-${randomUUID()}@test.local`;
  let userId = "";
  let headers: { authorization: string };
  const fetcher = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify({ meals: [meal] })));
  let service: ReturnType<typeof createDiscoveryService>;
  beforeAll(async () => {
    await app.ready();
    service = createDiscoveryService(app.prisma, { THEMEALDB_API_KEY: "test" }, fetcher);
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "food-test-password", displayName: "External Test" },
    });
    userId = registered.json().data.user.id;
    const session = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "food-test-password" },
    });
    headers = { authorization: `Bearer ${session.json().data.accessToken}` };
    const onboarding = await app.inject({
      method: "POST",
      url: "/users/me/onboarding",
      headers,
      payload: {
        spicyLevel: 20,
        sweetLevel: 20,
        sourLevel: 20,
        saltyLevel: 20,
        budgetMin: 0,
        budgetMax: 100000,
        maxDistanceMeters: 3000,
        latitude: 10.77,
        longitude: 106.7,
        allergies: [],
        dietaryRestrictions: [],
        cuisinePreferences: [],
      },
    });
    expect(onboarding.statusCode).toBe(200);
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email } });
    await app.close();
  });
  it("protects routes, validates source and coordinates, exposes no credentials", async () => {
    expect((await app.inject({ url: "/recipes?q=pho" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/recipes/javascript/12", headers })).statusCode).toBe(400);
    expect(
      (await app.inject({ url: "/discovery/restaurants?q=pho&latitude=10", headers })).statusCode,
    ).toBe(400);
    const response = await app.inject({ url: "/discovery/sources", headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.items).toHaveLength(6);
    expect(Object.keys(response.json().data.items[0]).sort()).toEqual([
      "configured",
      "source",
      "type",
    ]);
  });
  it("automatically fetches daily recipes, persists idempotently and expires at exactly 96h", async () => {
    const start = new Date();
    const key = randomUUID();
    expect((await service.today(userId, start)).items).toHaveLength(1);
    const recorded = await service.record(userId, "themealdb", "12", "EATEN", key);
    fetcher.mockClear();
    expect((await service.record(userId, "themealdb", "12", "EATEN", key)).id).toBe(recorded.id);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(service.record(userId, "themealdb", "12", "CHOSEN", key)).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    expect(
      (await service.today(userId, new Date(recorded.createdAt.getTime() + REPEAT_WINDOW_MS - 1)))
        .items,
    ).toHaveLength(0);
    expect(
      (await service.today(userId, new Date(recorded.createdAt.getTime() + REPEAT_WINDOW_MS)))
        .items,
    ).toHaveLength(1);
    // Explicit search remains independent of the recommendation cooldown.
    expect((await service.searchRecipes("Test external soup")).items).toHaveLength(1);
    const history = await app.inject({ url: "/users/me/recipe-history", headers });
    expect(history.json().data.items).toHaveLength(1);
    expect(history.json().data.items[0].userId).toBeUndefined();
  });
  it("does not return automatic recipes for an allergy profile", async () => {
    const allergen = await app.prisma.allergen.findFirstOrThrow();
    await app.prisma.userAllergy.create({ data: { userId, allergenId: allergen.id } });
    fetcher.mockClear();
    expect((await service.today(userId)).status).toBe("INSUFFICIENT_SAFETY_DATA");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
