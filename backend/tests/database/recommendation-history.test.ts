import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import {
  MealPeriod,
  RecommendationStatus,
  UserInteractionType,
} from "../../src/generated/prisma/enums.js";

describe("Recommendation history and feedback database integration", () => {
  let app: FastifyInstance;
  let userId: string;
  let cuisineId: string;
  let dishId: string;
  let restaurantId: string;
  let requestId: string;
  let resultId: string;

  const suffix = randomUUID();
  const email = `db05-${suffix}@rec-food.local`;
  const cuisineCode = `DB05_CUISINE_${suffix}`;
  const dishSlug = `db05-dish-${suffix}`;
  const googlePlaceId = `db05-place-${suffix}`;

  beforeAll(async () => {
    app = buildApp({ logger: false, database: true });
    await app.ready();

    const user = await app.prisma.user.create({
      data: {
        email,
        displayName: "DB05 Test User",
        passwordHash: "not-a-real-password-hash",
      },
    });
    userId = user.id;

    const cuisine = await app.prisma.cuisine.create({
      data: { code: cuisineCode, name: "DB05 Test Cuisine" },
    });
    cuisineId = cuisine.id;

    const dish = await app.prisma.dish.create({
      data: {
        slug: dishSlug,
        name: "DB05 Test Dish",
        cuisineId,
        priceMin: 30_000,
        priceMax: 90_000,
        spicyLevel: 25,
        sweetLevel: 35,
        sourLevel: 45,
        saltyLevel: 55,
      },
    });
    dishId = dish.id;

    const restaurant = await app.prisma.restaurant.create({
      data: {
        googlePlaceId,
        name: "DB05 Test Restaurant",
        address: "DB05 test address",
        latitude: "10.776889",
        longitude: "106.700806",
      },
    });
    restaurantId = restaurant.id;
  });

  afterAll(async () => {
    if (app.hasDecorator("prisma")) {
      await app.prisma.user.deleteMany({ where: { email } });
      await app.prisma.restaurant.deleteMany({ where: { googlePlaceId } });
      await app.prisma.dish.deleteMany({ where: { slug: dishSlug } });
      await app.prisma.cuisine.deleteMany({ where: { code: cuisineCode } });
    }
    await app.close();
  });

  it("lưu request context và đọc history mới nhất trước", async () => {
    const [older, newer] = await app.prisma.$transaction([
      app.prisma.recommendationRequest.create({
        data: {
          userId,
          requestedAt: new Date("2026-09-18T08:00:00.000Z"),
          latitude: "10.776889",
          longitude: "106.700806",
          mealPeriod: MealPeriod.BREAKFAST,
          weather: "sunny",
          budgetMin: 30_000,
          budgetMax: 100_000,
          maxDistanceMeters: 5_000,
          naturalLanguageRequest: "Món nước nhẹ",
          status: RecommendationStatus.SUCCESS,
        },
      }),
      app.prisma.recommendationRequest.create({
        data: {
          userId,
          requestedAt: new Date("2026-09-18T12:00:00.000Z"),
          latitude: "10.776889",
          longitude: "106.700806",
          mealPeriod: MealPeriod.LUNCH,
          status: RecommendationStatus.SUCCESS,
        },
      }),
    ]);
    requestId = newer.id;

    const history = await app.prisma.recommendationRequest.findMany({
      where: { userId },
      orderBy: { requestedAt: "desc" },
    });

    expect(history.map((item) => item.id)).toEqual([newer.id, older.id]);
  });

  it.each([
    ["latitude", { latitude: "91.000000" }],
    ["longitude", { longitude: "181.000000" }],
    ["budget âm", { budgetMin: -1, budgetMax: 50_000 }],
    ["budget đảo", { budgetMin: 80_000, budgetMax: 50_000 }],
    ["budget thiếu max", { budgetMin: 30_000 }],
    ["distance", { maxDistanceMeters: 0 }],
  ])("từ chối request %s ngoài constraint", async (_name, invalidValue) => {
    await expect(
      app.prisma.recommendationRequest.create({
        data: {
          userId,
          latitude: "10.000000",
          longitude: "106.000000",
          status: RecommendationStatus.FAILED,
          ...invalidValue,
        },
      }),
    ).rejects.toThrow();
  });

  it("lưu kết quả theo rank với score và safety warnings có cấu trúc", async () => {
    const [first, second] = await app.prisma.$transaction([
      app.prisma.recommendationResult.create({
        data: {
          requestId,
          dishId,
          restaurantId,
          rank: 1,
          baseScore: "82.5000",
          finalScore: "90.2500",
          reason: "Phù hợp khẩu vị và ngân sách",
          safetyWarnings: [{ code: "UNVERIFIED_ALLERGEN_DATA" }],
        },
      }),
      app.prisma.recommendationResult.create({
        data: {
          requestId,
          dishId,
          rank: 2,
          baseScore: "75.0000",
          finalScore: "78.0000",
          reason: "Lựa chọn dự phòng",
          safetyWarnings: [],
        },
      }),
    ]);
    resultId = first.id;

    const ranked = await app.prisma.recommendationResult.findMany({
      where: { requestId },
      orderBy: { rank: "asc" },
    });

    expect(ranked.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(ranked[0]?.safetyWarnings).toEqual([{ code: "UNVERIFIED_ALLERGEN_DATA" }]);
  });

  it("từ chối duplicate rank, rank/score sai và warnings không phải array", async () => {
    const baseData = {
      requestId,
      dishId,
      reason: "Constraint test",
      safetyWarnings: [] as never[],
    };

    await expect(
      app.prisma.recommendationResult.create({
        data: { ...baseData, rank: 1, baseScore: 50, finalScore: 50 },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.recommendationResult.create({
        data: { ...baseData, rank: 0, baseScore: 50, finalScore: 50 },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.recommendationResult.create({
        data: { ...baseData, rank: 3, baseScore: 101, finalScore: 50 },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.recommendationResult.create({
        data: {
          ...baseData,
          rank: 4,
          baseScore: 50,
          finalScore: 50,
          safetyWarnings: { code: "NOT_AN_ARRAY" },
        },
      }),
    ).rejects.toThrow();
  });

  it("ghi interaction idempotent và đọc history mới nhất trước", async () => {
    const viewed = await app.prisma.userInteraction.create({
      data: {
        userId,
        recommendationResultId: resultId,
        dishId,
        restaurantId,
        interactionType: UserInteractionType.VIEWED,
        idempotencyKey: `db05-viewed-${suffix}`,
        createdAt: new Date("2026-09-18T12:01:00.000Z"),
      },
    });
    const liked = await app.prisma.userInteraction.create({
      data: {
        userId,
        dishId,
        interactionType: UserInteractionType.LIKED,
        idempotencyKey: `db05-liked-${suffix}`,
        createdAt: new Date("2026-09-18T12:02:00.000Z"),
      },
    });

    await expect(
      app.prisma.userInteraction.create({
        data: {
          userId,
          dishId,
          interactionType: UserInteractionType.VIEWED,
          idempotencyKey: viewed.idempotencyKey,
        },
      }),
    ).rejects.toThrow();

    const history = await app.prisma.userInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    expect(history.slice(0, 2).map((item) => item.id)).toEqual([liked.id, viewed.id]);
    expect(liked.recommendationResultId).toBeNull();
  });

  it("enforce rating semantics", async () => {
    await app.prisma.userInteraction.create({
      data: {
        userId,
        dishId,
        interactionType: UserInteractionType.RATED,
        rating: 5,
        idempotencyKey: `db05-rating-valid-${suffix}`,
      },
    });

    await expect(
      app.prisma.userInteraction.create({
        data: {
          userId,
          dishId,
          interactionType: UserInteractionType.RATED,
          idempotencyKey: `db05-rating-missing-${suffix}`,
        },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.userInteraction.create({
        data: {
          userId,
          dishId,
          interactionType: UserInteractionType.RATED,
          rating: 6,
          idempotencyKey: `db05-rating-range-${suffix}`,
        },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.userInteraction.create({
        data: {
          userId,
          dishId,
          interactionType: UserInteractionType.LIKED,
          rating: 5,
          idempotencyKey: `db05-rating-wrong-type-${suffix}`,
        },
      }),
    ).rejects.toThrow();
  });

  it("bảo vệ catalog và cascade toàn bộ history khi xóa user", async () => {
    await expect(app.prisma.dish.delete({ where: { id: dishId } })).rejects.toThrow();
    await expect(app.prisma.restaurant.delete({ where: { id: restaurantId } })).rejects.toThrow();

    await app.prisma.user.delete({ where: { id: userId } });

    const [requests, results, interactions] = await app.prisma.$transaction([
      app.prisma.recommendationRequest.count({ where: { userId } }),
      app.prisma.recommendationResult.count({ where: { request: { userId } } }),
      app.prisma.userInteraction.count({ where: { userId } }),
    ]);
    expect({ requests, results, interactions }).toEqual({
      requests: 0,
      results: 0,
      interactions: 0,
    });
  });
});
