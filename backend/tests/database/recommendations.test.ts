import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createCandidateService } from "../../src/modules/recommendations/candidate.service.js";
import { createRecommendationService } from "../../src/modules/recommendations/recommendation.service.js";
import { createFoodService } from "../../src/modules/food/food.service.js";
import { foodIdentity } from "../../src/modules/food/food.identity.js";

describe("verified recommendation ownership and hard filters", () => {
  const app = buildApp({ logger: false }),
    suffix = randomUUID();
  const emails = [`recommend-${suffix}@test.local`, `recommend-other-${suffix}@test.local`];
  const context = { budget: 50000, radius: 3500, latitude: 10.77, longitude: 106.7 };
  let userId: string, dishId: string, restaurantId: string, supplierId: string, identityId: string;
  let headers: { authorization: string }, other: { authorization: string };
  let candidate: ReturnType<typeof createCandidateService>,
    service: ReturnType<typeof createRecommendationService>;
  beforeAll(async () => {
    await app.ready();
    candidate = createCandidateService(app.prisma, {});
    service = createRecommendationService(app.prisma, {});
    const sessions = [];
    for (const email of emails) {
      const registered = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "recommend-test-password", displayName: "Recommendation Test" },
      });
      expect(registered.statusCode).toBe(201);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "recommend-test-password" },
      });
      sessions.push({
        userId: registered.json().data.user.id as string,
        headers: { authorization: `Bearer ${login.json().data.accessToken}` },
      });
    }
    userId = sessions[0]!.userId;
    headers = sessions[0]!.headers;
    other = sessions[1]!.headers;
    await app.prisma.tasteProfile.create({
      data: {
        userId,
        spicyLevel: 30,
        sweetLevel: 30,
        sourLevel: 30,
        saltyLevel: 30,
        budgetMin: 0,
        budgetMax: 50000,
        maxDistanceMeters: 3500,
        onboardingCompleted: true,
        latitude: context.latitude,
        longitude: context.longitude,
      },
    });
    const cuisine = await app.prisma.cuisine.findFirstOrThrow();
    dishId = (
      await app.prisma.dish.create({
        data: {
          slug: `recommend-${suffix}`,
          name: `Recommendation fixture ${suffix}`,
          cuisineId: cuisine.id,
          spicyLevel: 30,
          sweetLevel: 30,
          sourLevel: 30,
          saltyLevel: 30,
          priceMin: 1000,
          priceMax: 100000,
        },
      })
    ).id;
    restaurantId = (
      await app.prisma.restaurant.create({
        data: {
          name: `Authorized venue ${suffix}`,
          address: "Fixture address",
          latitude: context.latitude,
          longitude: context.longitude,
          businessStatus: "OPERATIONAL",
        },
      })
    ).id;
    supplierId = (
      await app.prisma.merchantSupplier.create({
        data: {
          code: `test-${suffix}`,
          name: "Authorized fixture source",
          documentationUrl: "https://supplier.test/docs",
          authorizationReference: "test-only-contract",
          enabled: true,
        },
      })
    ).id;
    identityId = (
      await app.prisma.externalRestaurantIdentity.create({
        data: { supplierId, restaurantId, externalId: "venue" },
      })
    ).id;
    const run = await app.prisma.menuSyncRun.create({
      data: {
        supplierId,
        snapshotId: "fixture",
        mode: "DELTA",
        status: "COMMITTED",
        expectedPages: 1,
        observedAt: new Date(),
      },
    });
    const observedAt = new Date(Date.now() - 60000),
      expiresAt = new Date(Date.now() + 3600000);
    await app.prisma.externalMenuItem.createMany({
      data: [
        { externalId: "eligible", price: 45000, isAvailable: true, expiresAt },
        { externalId: "expensive", price: 55000, isAvailable: true, expiresAt },
        { externalId: "unavailable", price: 10000, isAvailable: false, expiresAt },
        {
          externalId: "expired",
          price: 10000,
          isAvailable: true,
          expiresAt: new Date(Date.now() - 30000),
        },
      ].map((item) => ({
        ...item,
        identityId,
        dishId,
        title: `Recommendation fixture ${suffix}`,
        sourceUrl: "https://supplier.test/menu",
        observedAt,
        lastSyncRunId: run.id,
        mappingStatus: "APPROVED" as const,
      })),
    });
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.prisma.offerSafetyEvidence.deleteMany({ where: { offer: { identityId } } });
    await app.prisma.externalMenuItem.deleteMany({ where: { identityId } });
    await app.prisma.externalRestaurantIdentity.deleteMany({ where: { supplierId } });
    await app.prisma.menuSyncRun.deleteMany({ where: { supplierId } });
    await app.prisma.merchantSupplier.deleteMany({ where: { id: supplierId } });
    await app.prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await app.prisma.dish.deleteMany({ where: { id: dishId } });
    await app.close();
  });
  it("uses real offer price rather than knowledge-bank ranges and rejects unavailable or expired offers", async () => {
    const result = await candidate.pool(userId, context);
    expect(result.items.filter((item) => item.dishId === dishId)).toHaveLength(1);
    expect(result.items.find((item) => item.dishId === dishId)).toMatchObject({
      price: 45000,
      budgetVerified: true,
      mediaKind: "VENUE",
      rating: null,
    });
    expect(
      (await candidate.pool(userId, { ...context, budget: 44000 })).items.some(
        (item) => item.dishId === dishId,
      ),
    ).toBe(false);
    expect(
      (await candidate.pool(userId, { ...context, latitude: 11 })).items.some(
        (item) => item.dishId === dishId,
      ),
    ).toBe(false);
    expect(
      (await candidate.pool(userId, { ...context, onlyOpen: true })).items.some(
        (item) => item.dishId === dishId,
      ),
    ).toBe(false);
  });
  it("persists owner-only permitted snapshots with idempotency and conflict semantics", async () => {
    const input = { ...context, idempotencyKey: randomUUID() };
    const first = await app.inject({
      method: "POST",
      url: "/recommendations",
      headers,
      payload: input,
    });
    expect(first.statusCode).toBe(200);
    const requestId = first.json().data.id;
    expect((await service.get(userId, requestId)).id).toBe(requestId);
    expect(first.json().data.items.some((item: { dishId: string }) => item.dishId === dishId)).toBe(
      true,
    );
    const replay = await app.inject({
      method: "POST",
      url: "/recommendations",
      headers,
      payload: input,
    });
    expect(replay.json().data).toMatchObject({ id: requestId, replayed: true });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/recommendations",
          headers,
          payload: { ...input, budget: 40000 },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await app.inject({ url: `/recommendations/${requestId}`, headers: other })).statusCode,
    ).toBe(404);
    expect((await app.inject({ url: `/recommendations/${requestId}` })).statusCode).toBe(401);
    const stored = await app.prisma.recommendationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { results: true },
    });
    expect(stored.naturalLanguageRequest).toBeNull();
    expect(JSON.stringify(stored)).not.toContain("googleusercontent");
    expect(stored.results.find((item) => item.dishId === dishId)?.price).toBe(45000);
    const resultId = stored.results.find((item) => item.dishId === dishId)!.id;
    const feedback = { resultId, type: "RATED", rating: 5, idempotencyKey: randomUUID() };
    const write = () =>
      app.inject({
        method: "POST",
        url: `/recommendations/${requestId}/feedback`,
        headers,
        payload: feedback,
      });
    const concurrent = await Promise.all([write(), write()]);
    expect(concurrent.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(concurrent[0]!.json().data.id).toBe(concurrent[1]!.json().data.id);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/recommendations/${requestId}/feedback`,
          headers: other,
          payload: feedback,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/recommendations/${requestId}/feedback`,
          headers,
          payload: { ...feedback, rating: 4 },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/recommendations/${requestId}/feedback`,
          headers,
          payload: { ...feedback, type: "SKIPPED", idempotencyKey: randomUUID() },
        })
      ).statusCode,
    ).toBe(400);
    const offer = await app.prisma.externalMenuItem.findUniqueOrThrow({
      where: { id: stored.results.find((item) => item.id === resultId)!.offerId! },
    });
    await app.prisma.externalMenuItem.update({
      where: { id: offer.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/recommendations/${requestId}/feedback`,
          headers,
          payload: { resultId, type: "CHOSEN", idempotencyKey: randomUUID() },
        })
      ).statusCode,
    ).toBe(409);
    await app.prisma.externalMenuItem.update({
      where: { id: offer.id },
      data: { expiresAt: offer.expiresAt },
    });
    await app.prisma.externalMenuItem.update({ where: { id: offer.id }, data: { price: 60000 } });
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/recommendations/${requestId}/feedback`,
          headers,
          payload: { resultId, type: "CHOSEN", idempotencyKey: randomUUID() },
        })
      ).statusCode,
    ).toBe(409);
    const eaten = await app.inject({
      method: "POST",
      url: `/recommendations/${requestId}/feedback`,
      headers,
      payload: {
        resultId,
        type: "EATEN",
        eatenAt: new Date(Date.now() - 86400000).toISOString(),
        idempotencyKey: randomUUID(),
      },
    });
    expect(eaten.statusCode).toBe(200);
    await app.prisma.userInteraction.delete({ where: { id: eaten.json().data.id } });
    await app.prisma.externalMenuItem.update({
      where: { id: offer.id },
      data: { price: offer.price },
    });
  });
  it("excludes CHOSEN/EATEN across offers for exactly 96 hours and recipe identity across sources", async () => {
    const now = new Date();
    const choice = await createFoodService(app.prisma).record(
      userId,
      dishId,
      "EATEN",
      randomUUID(),
      new Date(+now - 96 * 3600000 + 1000).toISOString(),
    );
    expect(
      (await candidate.pool(userId, context, true, now)).items.some(
        (item) => item.dishId === dishId,
      ),
    ).toBe(false);
    expect(
      (await candidate.pool(userId, context, true, new Date(+now + 1000))).items.some(
        (item) => item.dishId === dishId,
      ),
    ).toBe(true);
    await app.prisma.userInteraction.delete({ where: { id: choice.id } });
    await app.prisma.recipeInteraction.create({
      data: {
        userId,
        source: "themealdb",
        recipeId: "12",
        title: `Recommendation fixture ${suffix}`,
        canonicalName: foodIdentity(`Recommendation fixture ${suffix}`),
        interactionType: "CHOSEN",
        idempotencyKey: `${userId}:${randomUUID()}`,
      },
    });
    expect(
      (await candidate.pool(userId, context)).items.some((item) => item.dishId === dishId),
    ).toBe(false);
    await app.prisma.recipeInteraction.deleteMany({ where: { userId } });
  });
  it("fails closed for missing, pending, conflicting and expired offer-specific allergen evidence", async () => {
    const allergen = await app.prisma.allergen.findFirstOrThrow();
    await app.prisma.userAllergy.create({
      data: { userId, allergenId: allergen.id, severity: "UNKNOWN" },
    });
    expect(
      (await candidate.pool(userId, context)).items.some((item) => item.dishId === dishId),
    ).toBe(false);
    const offer = await app.prisma.externalMenuItem.findUniqueOrThrow({
      where: { identityId_externalId: { identityId, externalId: "eligible" } },
    });
    for (const kind of ["ALLERGEN", "CROSS_CONTACT"] as const)
      await app.prisma.offerSafetyEvidence.create({
        data: {
          offerId: offer.id,
          kind,
          code: allergen.code,
          claim: "ABSENT",
          status: "APPROVED",
          sourceUrl: "https://supplier.test/evidence",
          excerpt: "Specific authorized fixture evidence",
          observedAt: offer.observedAt,
          expiresAt: offer.expiresAt,
        },
      });
    expect(
      (await candidate.pool(userId, context)).items.some((item) => item.dishId === dishId),
    ).toBe(true);
    const conflict = await app.prisma.offerSafetyEvidence.create({
      data: {
        offerId: offer.id,
        kind: "ALLERGEN",
        code: allergen.code,
        claim: "PRESENT",
        status: "PENDING",
        sourceUrl: "https://supplier.test/evidence",
        excerpt: "Conflicting pending evidence",
        observedAt: offer.observedAt,
        expiresAt: offer.expiresAt,
      },
    });
    expect((await candidate.pool(userId, context)).status).toBe("NO_SAFE_MATCH");
    await app.prisma.offerSafetyEvidence.update({
      where: { id: conflict.id },
      data: { status: "REVOKED" },
    });
    await app.prisma.userAllergy.deleteMany({ where: { userId } });
  });
  it("gates unprocessed profiles and rolls back stale profile ranking without storing invented results", async () => {
    await app.prisma.personalFoodKnowledge.create({
      data: { userId, description: "Mô tả chưa phân tích", revision: 1, analyzedRevision: 0 },
    });
    expect((await candidate.pool(userId, context)).status).toBe("PROFILE_PENDING_ANALYSIS");
    await app.prisma.personalFoodKnowledge.update({
      where: { userId },
      data: { analyzedRevision: 1 },
    });
    const stale = createRecommendationService(app.prisma, {}, fetch, {
      configured: true,
      model: "test",
      generate: async (_instruction, input) => {
        await app.prisma.personalFoodKnowledge.update({ where: { userId }, data: { revision: 2 } });
        return {
          items: (input as Array<{ id: string }>).map((item) => ({
            id: item.id,
            reasonCodes: ["BUDGET_MATCH"],
          })),
        };
      },
    });
    await expect(
      stale.recommend(userId, { ...context, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "RECOMMENDATION_PROFILE_CHANGED" });
    await app.prisma.personalFoodKnowledge.delete({ where: { userId } });
  });
  it("saves budget/radius separately from taste extraction and validates location pairs", async () => {
    const before = await app.prisma.tasteProfile.findUniqueOrThrow({ where: { userId } });
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/users/me/discovery-settings",
          headers,
          payload: { budget: 30000, radius: 4000, onlyOpen: true, latitude: 10 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/users/me/discovery-settings",
          headers,
          payload: {
            budget: 30000,
            radius: 4000,
            onlyOpen: true,
            latitude: 10.77,
            longitude: 106.7,
          },
        })
      ).statusCode,
    ).toBe(200);
    expect(await candidate.context(userId, {})).toMatchObject({
      budget: 30000,
      radius: 4000,
      onlyOpen: true,
    });
    expect(
      (await app.prisma.tasteProfile.findUniqueOrThrow({ where: { userId } })).updatedAt,
    ).toEqual(before.updatedAt);
  });
});
