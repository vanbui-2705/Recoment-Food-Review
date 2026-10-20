import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createFoodService } from "../../src/modules/food/food.service.js";

describe("behavioral catalog personalization", () => {
  const app = buildApp({ logger: false });
  const suffix = randomUUID();
  const emails = [`learn-a-${suffix}@test.local`, `learn-b-${suffix}@test.local`];
  const dishIds: string[] = [];
  let firstUserId = "";
  let firstHeaders: { authorization: string };
  let secondUserId = "";
  let secondHeaders: { authorization: string };

  async function register(email: string) {
    const created = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "behavior-test-password", displayName: "Behavior Test" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "behavior-test-password" },
    });
    const headers = { authorization: `Bearer ${login.json().data.accessToken}` };
    await app.inject({
      method: "POST",
      url: "/users/me/onboarding",
      headers,
      payload: {
        spicyLevel: 20,
        sweetLevel: 20,
        sourLevel: 20,
        saltyLevel: 20,
        budgetMin: 0,
        budgetMax: 1_000_000,
        maxDistanceMeters: 3000,
        latitude: 10.77,
        longitude: 106.7,
        allergies: [],
        dietaryRestrictions: [],
        cuisinePreferences: [],
      },
    });
    return { id: created.json().data.user.id as string, headers };
  }

  beforeAll(async () => {
    await app.ready();
    const first = await register(emails[0]!);
    const second = await register(emails[1]!);
    firstUserId = first.id;
    firstHeaders = first.headers;
    secondUserId = second.id;
    secondHeaders = second.headers;
    const vietnamese = await app.prisma.cuisine.findUniqueOrThrow({ where: { code: "VIETNAMESE" } });
    const japanese = await app.prisma.cuisine.findUniqueOrThrow({ where: { code: "JAPANESE" } });
    const create = async (
      key: string,
      cuisineId: string,
      level: number,
    ) => {
      const row = await app.prisma.dish.create({
        data: {
          slug: `behavior-${key}-${suffix}`,
          name: `Behavior ${key} ${suffix}`,
          cuisineId,
          priceMin: 40_000,
          priceMax: 80_000,
          spicyLevel: level,
          sweetLevel: level,
          sourLevel: level,
          saltyLevel: level,
          evidenceSource: "Behavioral personalization database test",
          verificationStatus: "REVIEWED",
          mealPeriods: ["DINNER"],
        },
      });
      dishIds.push(row.id);
    };
    await create("source", vietnamese.id, 40);
    await create("similar", vietnamese.id, 40);
    await create("control", japanese.id, 35);
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.prisma.dish.deleteMany({ where: { id: { in: dishIds } } });
    await app.close();
  });

  it("learns related-dish affinity for one user while preserving idempotency and isolation", async () => {
    const [sourceId, similarId, controlId] = dishIds;
    const service = createFoodService(app.prisma);
    const baselineFirst = await service.today(firstUserId, new Date(), "DINNER");
    const baselineSecond = await service.today(secondUserId, new Date(), "DINNER");
    const baselineSimilar = baselineFirst.items.find((item) => item.id === similarId)!;
    const baselineControl = baselineFirst.items.find((item) => item.id === controlId)!;
    expect(baselineSimilar.score).toBeLessThan(baselineControl.score);

    const viewKey = randomUUID();
    const view = await app.inject({
      method: "POST",
      url: `/users/me/dishes/${sourceId}/interactions`,
      headers: firstHeaders,
      payload: { type: "VIEWED", idempotencyKey: viewKey },
    });
    const replay = await app.inject({
      method: "POST",
      url: `/users/me/dishes/${sourceId}/interactions`,
      headers: firstHeaders,
      payload: { type: "VIEWED", idempotencyKey: viewKey },
    });
    expect(view.statusCode).toBe(200);
    expect(replay.json().data.id).toBe(view.json().data.id);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/users/me/dishes/${sourceId}/interactions`,
          headers: firstHeaders,
          payload: { type: "SKIPPED", idempotencyKey: viewKey },
        })
      ).statusCode,
    ).toBe(409);

    await app.inject({
      method: "PUT",
      url: `/users/me/dishes/${sourceId}/preference`,
      headers: firstHeaders,
      payload: { preference: "LIKED" },
    });
    await app.inject({
      method: "POST",
      url: `/users/me/dishes/${sourceId}/interactions`,
      headers: firstHeaders,
      payload: { type: "LIKED", idempotencyKey: randomUUID() },
    });

    const learnedFirst = await service.today(firstUserId, new Date(), "DINNER");
    const unchangedSecond = await service.today(secondUserId, new Date(), "DINNER");
    const learnedSimilar = learnedFirst.items.find((item) => item.id === similarId)!;
    const learnedControl = learnedFirst.items.find((item) => item.id === controlId)!;
    expect(learnedSimilar.score).toBeGreaterThan(learnedControl.score);
    expect(learnedSimilar.behaviorAdjustment).toBeGreaterThan(learnedControl.behaviorAdjustment);
    expect(learnedSimilar.learnedReason).toContain("nền ẩm thực");
    expect(learnedFirst.learning).toMatchObject({ privateToUser: true });
    expect(learnedFirst.learning.sampleSize).toBeGreaterThanOrEqual(3);

    const secondSimilar = unchangedSecond.items.find((item) => item.id === similarId)!;
    expect(secondSimilar.score).toBe(baselineSecond.items.find((item) => item.id === similarId)!.score);
    expect(unchangedSecond.learning.sampleSize).toBe(0);
    expect(
      await app.prisma.userInteraction.count({ where: { userId: secondUserId } }),
    ).toBe(0);

    const skipped = await app.inject({
      method: "POST",
      url: `/users/me/dishes/${similarId}/interactions`,
      headers: firstHeaders,
      payload: { type: "SKIPPED", idempotencyKey: randomUUID() },
    });
    expect(skipped.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/users/me/dishes/${controlId}/interactions`,
          headers: secondHeaders,
          payload: { type: "RATED", rating: 6, idempotencyKey: randomUUID() },
        })
      ).statusCode,
    ).toBe(400);
  });
});
