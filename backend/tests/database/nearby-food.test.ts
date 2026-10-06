import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { createNearbyFoodService } from "../../src/modules/discovery/nearby-food.service.js";
import { createFoodService } from "../../src/modules/food/food.service.js";
describe("nearby food discovery", () => {
  const app = buildApp({ logger: false });
  const suffix = randomUUID();
  const email = `nearby-${suffix}@test.local`;
  let userId: string;
  let headers: { authorization: string };
  let dishId: string;
  const restaurantIds: string[] = [];
  const googleId = `nearby-${suffix}`;
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              id: googleId,
              displayName: { text: "Real API fixture restaurant" },
              formattedAddress: "Fixture address",
              location: { latitude: 10.77, longitude: 106.7 },
              businessStatus: "OPERATIONAL",
              rating: 4.5,
              userRatingCount: 120,
              currentOpeningHours: { openNow: true },
              photos: [
                {
                  name: `places/${googleId}/photos/photo1`,
                  authorAttributions: [
                    { displayName: "Photo author", uri: "https://example.com/author" },
                  ],
                },
              ],
            },
          ],
        }),
      ),
  );
  beforeAll(async () => {
    await app.ready();
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "nearby-test-password", displayName: "Nearby Test" },
    });
    userId = register.json().data.user.id;
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "nearby-test-password" },
    });
    headers = { authorization: `Bearer ${login.json().data.accessToken}` };
    const cuisine = await app.prisma.cuisine.findFirstOrThrow();
    const dish = await app.prisma.dish.create({
      data: {
        slug: `nearby-${suffix}`,
        name: "Nearby test dish",
        cuisineId: cuisine.id,
        priceMin: 10000,
        priceMax: 90000,
        spicyLevel: 10,
        sweetLevel: 10,
        sourLevel: 10,
        saltyLevel: 10,
      },
    });
    dishId = dish.id;
    const cases = [
      {
        latitude: 10.77,
        price: 45000,
        source: "https://merchant.example/menu",
        verifiedAt: new Date(),
      },
      {
        latitude: 10.77,
        price: 60000,
        source: "https://merchant.example/menu",
        verifiedAt: new Date(),
      },
      {
        latitude: 11,
        price: 45000,
        source: "https://merchant.example/menu",
        verifiedAt: new Date(),
      },
      {
        latitude: 10.77,
        price: 45000,
        source: "DB04 development seed menu",
        verifiedAt: new Date(),
      },
      {
        latitude: 10.77,
        price: 45000,
        source: "https://merchant.example/menu",
        verifiedAt: new Date(Date.now() - 2 * 86400000),
      },
    ];
    for (const [i, item] of cases.entries()) {
      const restaurant = await app.prisma.restaurant.create({
        data: {
          name: `Nearby fixture ${i}`,
          address: "Fixture address",
          latitude: item.latitude,
          longitude: 106.7,
          businessStatus: "OPERATIONAL",
          ...(i === 0 ? { googlePlaceId: googleId } : {}),
        },
      });
      restaurantIds.push(restaurant.id);
      await app.prisma.restaurantDish.create({
        data: {
          restaurantId: restaurant.id,
          dishId,
          price: item.price,
          source: item.source,
          verifiedAt: item.verifiedAt,
        },
      });
    }
    await app.prisma.personalFoodKnowledge.create({
      data: { userId, description: "Khẩu vị chưa phân tích" },
    });
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await app.prisma.user.deleteMany({ where: { email } });
    await app.prisma.restaurant.deleteMany({ where: { id: { in: restaurantIds } } });
    if (dishId) await app.prisma.dish.delete({ where: { id: dishId } });
    await app.close();
  });
  it("requires location, authenticates and rejects invalid budget/radius", async () => {
    expect((await app.inject({ url: "/discovery/nearby-food?budget=50000" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/discovery/nearby-food?budget=0", headers })).statusCode).toBe(
      400,
    );
    expect(
      (await app.inject({ url: "/discovery/nearby-food?budget=50000&radius=5000", headers }))
        .statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: "/discovery/nearby-food?budget=50000&latitude=10", headers }))
        .statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: "/discovery/nearby-food?budget=50000", headers })).json().error.code,
    ).toBe("LOCATION_REQUIRED");
  });
  it("filters confirmed menu prices, distance, freshness and excludes development samples without waiting for AI", async () => {
    const result = await createNearbyFoodService(
      app.prisma,
      { GOOGLE_PLACES_API_KEY: "test" },
      fetcher,
    ).search(userId, 50000, { latitude: 10.77, longitude: 106.7 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      price: 45000,
      budgetVerified: true,
      menuConfirmed: true,
      rating: 4.5,
      ratingCount: 120,
      distanceMeters: 0,
    });
    expect(result.items[0]?.photo?.authors[0]?.name).toBe("Photo author");
    expect(result.restaurants[0]?.price).toBeNull();
  });
  it("hides a chosen dish for the existing 96-hour cooldown", async () => {
    await createFoodService(app.prisma).record(userId, dishId, "CHOSEN", randomUUID());
    const result = await createNearbyFoodService(
      app.prisma,
      { GOOGLE_PLACES_API_KEY: "test" },
      fetcher,
    ).search(userId, 50000, { latitude: 10.77, longitude: 106.7 });
    expect(result.items).toHaveLength(0);
    expect(result.restaurants).toHaveLength(1);
  });
  it("authenticates photo requests and keeps API keys off image URLs", async () => {
    const url = "/places/photo?name=places/test/photos/photo1";
    expect((await app.inject({ url })).statusCode).toBe(401);
    expect(
      (await app.inject({ url: "/places/photo?name=https://example.com/secret", headers }))
        .statusCode,
    ).toBe(400);
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "private-test-key");
    const transport = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ photoUri: "https://lh3.googleusercontent.com/photo" })),
      );
    vi.stubGlobal("fetch", transport);
    const response = await app.inject({ url, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.imageUrl).toBe("https://lh3.googleusercontent.com/photo");
    expect(response.body).not.toContain("private-test-key");
    expect(transport.mock.calls[0]![1].headers["X-Goog-Api-Key"]).toBe("private-test-key");
  });
});
