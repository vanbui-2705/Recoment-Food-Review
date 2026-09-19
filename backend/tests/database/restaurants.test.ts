import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { RestaurantBusinessStatus } from "../../src/generated/prisma/enums.js";

describe("Restaurant and Places database integration", () => {
  let app: FastifyInstance;
  let cuisineId: string;
  let dishId: string;
  let restaurantId: string;
  let manualRestaurantIds: string[] = [];

  const suffix = randomUUID();
  const cuisineCode = `DB04_CUISINE_${suffix}`;
  const dishSlug = `db04-dish-${suffix}`;
  const googlePlaceId = `db04-place-${suffix}`;
  const namePrefix = `DB04 ${suffix}`;

  beforeAll(async () => {
    app = buildApp({ logger: false, database: true });
    await app.ready();

    const cuisine = await app.prisma.cuisine.create({
      data: { code: cuisineCode, name: `${namePrefix} cuisine` },
    });
    cuisineId = cuisine.id;

    const dish = await app.prisma.dish.create({
      data: {
        slug: dishSlug,
        name: `${namePrefix} dish`,
        cuisineId,
        priceMin: 20_000,
        priceMax: 80_000,
        spicyLevel: 20,
        sweetLevel: 30,
        sourLevel: 40,
        saltyLevel: 50,
      },
    });
    dishId = dish.id;

    const restaurant = await app.prisma.restaurant.create({
      data: {
        googlePlaceId,
        name: `${namePrefix} restaurant`,
        address: "Test address",
        latitude: "10.776889",
        longitude: "106.700806",
        rating: "4.2",
        ratingCount: 10,
        priceLevel: 2,
        businessStatus: RestaurantBusinessStatus.OPERATIONAL,
        placesDataUpdatedAt: new Date(),
      },
    });
    restaurantId = restaurant.id;
  });

  afterAll(async () => {
    if (app.hasDecorator("prisma")) {
      await app.prisma.restaurant.deleteMany({ where: { name: { startsWith: namePrefix } } });
      await app.prisma.dish.deleteMany({ where: { slug: dishSlug } });
      await app.prisma.cuisine.deleteMany({ where: { code: cuisineCode } });
    }
    await app.close();
  });

  it("upsert theo Google Place ID và cho phép restaurant nhập tay", async () => {
    const updated = await app.prisma.restaurant.upsert({
      where: { googlePlaceId },
      update: { rating: "4.5", ratingCount: 12 },
      create: {
        googlePlaceId,
        name: "Should not be created",
        address: "Test address",
        latitude: "10.000000",
        longitude: "106.000000",
      },
    });

    const manualRestaurants = await app.prisma.$transaction([
      app.prisma.restaurant.create({
        data: {
          name: `${namePrefix} manual one`,
          address: "Manual address 1",
          latitude: "10.700000",
          longitude: "106.600000",
        },
      }),
      app.prisma.restaurant.create({
        data: {
          name: `${namePrefix} manual two`,
          address: "Manual address 2",
          latitude: "10.710000",
          longitude: "106.610000",
        },
      }),
    ]);
    manualRestaurantIds = manualRestaurants.map((item) => item.id);

    expect(updated.id).toBe(restaurantId);
    expect(updated.rating.toString()).toBe("4.5");
    expect(await app.prisma.restaurant.count({ where: { googlePlaceId } })).toBe(1);
    expect(manualRestaurants.every((item) => item.googlePlaceId === null)).toBe(true);
  });

  it.each([
    ["latitude", { latitude: "91.000000" }],
    ["longitude", { longitude: "181.000000" }],
    ["rating", { rating: "5.1" }],
    ["rating count", { ratingCount: -1 }],
    ["price level", { priceLevel: 5 }],
  ])("từ chối place metadata %s ngoài constraint", async (_name, invalidValue) => {
    await expect(
      app.prisma.restaurant.create({
        data: {
          name: `${namePrefix} invalid ${randomUUID()}`,
          address: "Invalid address",
          latitude: "10.000000",
          longitude: "106.000000",
          rating: "4.0",
          ratingCount: 0,
          priceLevel: 1,
          ...invalidValue,
        },
      }),
    ).rejects.toThrow();
  });

  it("enforce menu uniqueness, giá và nguồn bằng chứng", async () => {
    await app.prisma.restaurantDish.create({
      data: {
        restaurantId,
        dishId,
        price: 55_000,
        source: "DB04 database test menu",
        verifiedAt: new Date(),
      },
    });

    await expect(
      app.prisma.restaurantDish.create({
        data: { restaurantId, dishId, price: 60_000, source: "Duplicate" },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.restaurantDish.create({
        data: {
          restaurantId: manualRestaurantIds[0]!,
          dishId,
          price: -1,
          source: "Invalid price",
        },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.restaurantDish.create({
        data: {
          restaurantId: manualRestaurantIds[1]!,
          dishId,
          price: 50_000,
          source: "   ",
        },
      }),
    ).rejects.toThrow();
  });

  it("restrict dish deletion và cascade menu khi xóa restaurant", async () => {
    await expect(app.prisma.dish.delete({ where: { id: dishId } })).rejects.toThrow();

    await app.prisma.restaurant.delete({ where: { id: restaurantId } });

    expect(await app.prisma.restaurantDish.count({ where: { restaurantId } })).toBe(0);
  });
});
