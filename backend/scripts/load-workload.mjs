// Executed inside the recovery drill container, never against the application DATABASE_URL.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import console from "node:console";
import process from "node:process";
import { buildApp } from "./dist/app.js";
import { createRecommendationService } from "./dist/modules/recommendations/recommendation.service.js";
import { createTasteAnalysisService } from "./dist/modules/taste-analysis/taste-analysis.service.js";
import { loadAiConfig } from "./dist/modules/ai/ai.config.js";
import { createChatService } from "./dist/modules/chat/chat.service.js";

assert.equal(
  process.env.SECURITY_NAMESPACE,
  "recovery-drill",
  "Only the isolated recovery drill may execute this workload",
);
const app = buildApp({ logger: false });
await app.ready();
const count = 40,
  concurrency = 5;
async function measured(items, work) {
  const latencies = [],
    started = performance.now();
  let next = 0,
    failures = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < items.length) {
        const item = items[next++],
          start = performance.now();
        try {
          await work(item);
        } catch (error) {
          failures++;
          if (failures === 1)
            console.error(
              JSON.stringify({
                code: error.code || "LOAD_WORK_FAILED",
                actual: typeof error.actual === "string" ? error.actual : null,
                expected: typeof error.expected === "string" ? error.expected : null,
              }),
            );
        }
        latencies.push(performance.now() - start);
      }
    }),
  );
  latencies.sort((a, b) => a - b);
  const elapsedMs = performance.now() - started;
  return {
    requests: items.length,
    concurrency,
    failures,
    totalMs: Math.round(elapsedMs),
    requestsPerSecond: +((items.length * 1000) / elapsedMs).toFixed(2),
    p50Ms: Math.round(latencies[Math.ceil(latencies.length * 0.5) - 1]),
    p95Ms: Math.round(latencies[Math.ceil(latencies.length * 0.95) - 1]),
    p99Ms: Math.round(latencies[Math.ceil(latencies.length * 0.99) - 1]),
  };
}
try {
  const passwordHash = (
    await app.prisma.user.findUniqueOrThrow({ where: { email: "owner@drill.invalid" } })
  ).passwordHash;
  const users = Array.from({ length: count }, (_, index) => ({
    id: randomUUID(),
    email: `load-${index}@drill.invalid`,
    displayName: "Synthetic load",
    passwordHash,
  }));
  await app.prisma.user.createMany({ data: users });
  await app.prisma.tasteProfile.createMany({
    data: users.map(({ id: userId }) => ({
      userId,
      spicyLevel: 20,
      sweetLevel: 20,
      sourLevel: 20,
      saltyLevel: 20,
      budgetMin: 0,
      budgetMax: 50000,
      maxDistanceMeters: 3500,
      latitude: 10.77,
      longitude: 106.7,
      onboardingCompleted: true,
    })),
  });
  const cuisine = await app.prisma.cuisine.findFirstOrThrow();
  const dishes = Array.from({ length: 30 }, (_, index) => ({
    id: randomUUID(),
    slug: `load-${index}`,
    name: `Synthetic dish ${index}`,
    cuisineId: cuisine.id,
    priceMin: 10000,
    priceMax: 50000,
    spicyLevel: 20,
    sweetLevel: 20,
    sourLevel: 20,
    saltyLevel: 20,
  }));
  await app.prisma.dish.createMany({ data: dishes });
  const restaurant = await app.prisma.restaurant.create({
    data: {
      name: "Synthetic venue",
      address: "Synthetic address",
      latitude: 10.77,
      longitude: 106.7,
      businessStatus: "OPERATIONAL",
    },
  });
  const supplier = await app.prisma.merchantSupplier.create({
    data: {
      code: "load-only",
      name: "Synthetic contracted source",
      documentationUrl: "https://drill.invalid/docs",
      authorizationReference: "synthetic-only",
      enabled: true,
    },
  });
  const identity = await app.prisma.externalRestaurantIdentity.create({
    data: { supplierId: supplier.id, restaurantId: restaurant.id, externalId: "load-only" },
  });
  const sync = await app.prisma.menuSyncRun.create({
    data: {
      supplierId: supplier.id,
      snapshotId: "load-only",
      mode: "DELTA",
      status: "COMMITTED",
      expectedPages: 1,
      observedAt: new Date(),
    },
  });
  await app.prisma.externalMenuItem.createMany({
    data: dishes.map((dish, index) => ({
      identityId: identity.id,
      externalId: String(index),
      title: dish.name,
      dishId: dish.id,
      price: 30000 + index * 100,
      currency: "VND",
      sourceUrl: "https://drill.invalid/menu",
      observedAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 3600000),
      lastSyncRunId: sync.id,
      mappingStatus: "APPROVED",
      isAvailable: true,
    })),
  });
  const context = { budget: 50000, radius: 3500, latitude: 10.77, longitude: 106.7 };
  const recommendation = createRecommendationService(app.prisma, {});
  const discovery = await measured(users, async ({ id }) => {
    const result = await recommendation.recommend(id, { ...context, idempotencyKey: randomUUID() });
    assert.ok(result.items.length > 0);
    assert.ok(result.items.length <= 20);
  });
  if (discovery.failures)
    throw Object.assign(new Error("Synthetic discovery failed"), { code: "LOAD_DISCOVERY_FAILED" });
  await app.prisma.personalFoodKnowledge.createMany({
    data: users.map(({ id: userId }) => ({
      userId,
      description: "Synthetic mild food note",
      revision: 1,
    })),
  });
  await app.prisma.tasteAnalysisJob.createMany({
    data: users.map(({ id: userId }) => ({ userId, sourceRevision: 1 })),
  });
  const empty = { fields: [], allergies: [], diets: [], cuisines: [], dishes: [], questions: [] };
  const config = loadAiConfig({
    ...process.env,
    LLM_API_KEY: "synthetic-not-sent",
    LLM_DAILY_REQUEST_LIMIT: "100000",
  });
  const analysisService = createTasteAnalysisService(app.prisma, config, {
    configured: true,
    model: "synthetic",
    generate: async () => {
      await delay(10);
      return empty;
    },
  });
  const analysis = await measured(users, async ({ id }) => {
    assert.equal(await analysisService.tick(new Date(), id), true);
    assert.equal((await analysisService.latest(id)).status, "APPLIED");
  });
  if (analysis.failures)
    throw Object.assign(new Error("Synthetic analysis failed"), { code: "LOAD_ANALYSIS_FAILED" });
  const chatService = createChatService(
    app.prisma,
    { LLM_DAILY_REQUEST_LIMIT: "100000" },
    {
      configured: true,
      model: "synthetic",
      generate: async () => {
        await delay(10);
        return { reply: "RESULTS", tools: [{ name: "RECOMMEND", args: {} }] };
      },
    },
    async (userId, _tool, input, key) => {
      const result = await recommendation.recommend(userId, { ...input, idempotencyKey: key });
      return { status: result.status, references: [{ kind: "RECOMMENDATION", id: result.id }] };
    },
  );
  const chat = await measured(users, async ({ id }) => {
    const conversation = await chatService.create(id);
    const run = await chatService.submit(
      id,
      conversation.id,
      "Synthetic food request",
      randomUUID(),
      context,
    );
    assert.equal(await chatService.tick(id), true);
    assert.equal((await chatService.events(id, run.id, 0)).status, "COMPLETED");
  });
  if (chat.failures)
    throw Object.assign(new Error("Synthetic chat failed"), { code: "LOAD_CHAT_FAILED" });
  assert.equal(
    discovery.failures + analysis.failures + chat.failures,
    0,
    "All benchmark requests must complete correctly",
  );
  console.log(
    JSON.stringify({
      synthetic: true,
      fakeProviderDelayMs: 10,
      transport: "in-process services with real PostgreSQL",
      candidateOffers: 30,
      discovery,
      analysis,
      chat,
    }),
  );
} finally {
  await app.close();
}
