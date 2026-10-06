import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { createDiscoveryService } from "../../src/modules/discovery/discovery.service.js";
import { REPEAT_WINDOW_MS } from "../../src/modules/food/food.policy.js";
import { normalizeFoodText } from "../../src/modules/food/food.schema.js";
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
  it("keeps ambiguous recipe aliases separate and links only an unambiguous canonical dish", async () => {
    await app.prisma.userAllergy.deleteMany({ where: { userId } });
    const suffix = randomUUID(),
      title = `Collision recipe ${suffix}`,
      dishIds: string[] = [];
    const oldMeal = { ...meal };
    try {
      const cuisine = await app.prisma.cuisine.findFirstOrThrow();
      for (let i = 0; i < 2; i++) {
        const dish = await app.prisma.dish.create({
          data: {
            slug: `recipe-collision-${suffix}-${i}`,
            name: `Different dish ${suffix} ${i}`,
            cuisineId: cuisine.id,
            spicyLevel: 0,
            sweetLevel: 0,
            sourLevel: 0,
            saltyLevel: 0,
            priceMin: 1000,
            priceMax: 50000,
            aliases: { create: { alias: title, normalizedAlias: normalizeFoodText(title) } },
          },
        });
        dishIds.push(dish.id);
      }
      meal.idMeal = "13";
      meal.strMeal = title;
      const ambiguous = await service.record(userId, "themealdb", "13", "CHOSEN", randomUUID());
      expect(ambiguous.canonicalDishId).toBeNull();
      expect(ambiguous.canonicalName).toBe("recipe:themealdb:13");
      expect((await service.today(userId)).items).toHaveLength(0);
      await app.prisma.dishAlias.deleteMany({ where: { dishId: dishIds[1] } });
      meal.idMeal = "14";
      const mapped = await service.record(userId, "themealdb", "14", "CHOSEN", randomUUID());
      expect(mapped.canonicalDishId).toBe(dishIds[0]);
    } finally {
      Object.assign(meal, oldMeal);
      await app.prisma.recipeInteraction.deleteMany({
        where: { userId, recipeId: { in: ["13", "14"] } },
      });
      await app.prisma.dish.deleteMany({ where: { id: { in: dishIds } } });
    }
  });
});
