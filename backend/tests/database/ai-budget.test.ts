import { it, expect, vi, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import { randomUUID } from "node:crypto";
import { AiError } from "../../src/modules/ai/ai.provider.js";
import { createTasteAnalysisService } from "../../src/modules/taste-analysis/taste-analysis.service.js";
import { loadAiConfig } from "../../src/modules/ai/ai.config.js";
import { reserveAiBudget, createBudgetedGeminiProvider } from "../../src/modules/ai/ai.budget.js";
const apps = [buildApp({ logger: false }), buildApp({ logger: false })];
beforeAll(async () => {
  for (const app of apps) await app.ready();
});
afterAll(async () => {
  for (const app of apps) await app.close();
});
it("never overspends the shared budget across replicas and does not reserve an oversized first request", async () => {
  const config = loadAiConfig({ LLM_DAILY_BUDGET_USD: "0.5" });
  expect(await reserveAiBudget(apps[0]!.prisma, config, 500001n)).toBe(false);
  const results = await Promise.all(
    Array.from({ length: 40 }, (_, index) =>
      reserveAiBudget(apps[index % 2]!.prisma, config, 100000n),
    ),
  );
  expect(results.filter(Boolean)).toHaveLength(5);
  const rows = await apps[0]!.prisma.aiBudgetUsage.findMany({
    where: { namespace: process.env.SECURITY_NAMESPACE },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]!.reservedMicros).toBe(500000n);
  expect(rows[0]!.requests).toBe(5);
});
it("blocks provider calls when the budget store fails without exposing database or request secrets", async () => {
  const fetcher = vi.fn();
  const failure = vi
    .spyOn(apps[0]!.prisma, "$transaction")
    .mockRejectedValueOnce(new Error("private-database-secret"));
  try {
    const provider = createBudgetedGeminiProvider(
      apps[0]!.prisma,
      loadAiConfig({ LLM_API_KEY: "private-key" }),
      fetcher,
    );
    await expect(provider.generate("private-taste", {}, {})).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
      message: "AI_UNAVAILABLE",
    });
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    failure.mockRestore();
  }
});
it("stops a budget-blocked analysis after one attempt while retaining the unprocessed safety note", async () => {
  const prisma = apps[0]!.prisma;
  const user = await prisma.user.create({
    data: {
      email: `budget-${randomUUID()}@test.local`,
      displayName: "Budget fixture",
      passwordHash: "unused",
    },
  });
  try {
    await prisma.personalFoodKnowledge.create({
      data: { userId: user.id, description: "Dị ứng đậu phộng", revision: 1, analyzedRevision: 0 },
    });
    const service = createTasteAnalysisService(prisma, loadAiConfig({ WORKER_ENABLED: "true" }), {
      configured: true,
      model: "fake",
      generate: async () => {
        throw new AiError("AI_BUDGET_EXCEEDED");
      },
    });
    await service.start(user.id);
    expect(await service.tick(new Date(), user.id)).toBe(true);
    expect(await service.tick(new Date(), user.id)).toBe(false);
    expect(
      await prisma.tasteAnalysisJob.findFirstOrThrow({ where: { userId: user.id } }),
    ).toMatchObject({ status: "FAILED", attempt: 1, errorCode: "AI_BUDGET_EXCEEDED" });
    expect(
      await prisma.personalFoodKnowledge.findUniqueOrThrow({ where: { userId: user.id } }),
    ).toMatchObject({ analyzedRevision: 0, description: "Dị ứng đậu phộng" });
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
