import { it, expect, vi } from "vitest";
import { loadAiConfig } from "../../src/modules/ai/ai.config.js";
import { estimatedBudgetMicros } from "../../src/modules/ai/ai.budget.policy.js";
import { createGeminiProvider } from "../../src/modules/ai/ai.provider.js";
it("reserves reasoning output separately and validates tariff/model configuration", () => {
  const config = loadAiConfig({});
  expect(estimatedBudgetMicros(config, 0)).toBeGreaterThan(900000n);
  expect(estimatedBudgetMicros(config, 10000)).toBeGreaterThan(estimatedBudgetMicros(config, 0));
  expect(() => estimatedBudgetMicros(config, 65537)).toThrow();
  for (const env of [
    { LLM_DAILY_BUDGET_USD: "-1" },
    { LLM_INPUT_USD_PER_MILLION: "0" },
    { LLM_OUTPUT_USD_PER_MILLION: "NaN" },
    { LLM_API_KEY: "fake", LLM_MODEL: "gemini-unknown" },
    { LLM_PRICING_VALID_UNTIL: "2027-02-30" },
  ])
    expect(() => loadAiConfig(env)).toThrow();
});
it("never calls a provider without a budget reservation or after the pricing contract expires", async () => {
  const fetcher = vi.fn(),
    reservation = vi.fn(async () => false),
    config = loadAiConfig({ LLM_API_KEY: "fake" });
  await expect(createGeminiProvider(config, fetcher).generate("", {}, {})).rejects.toMatchObject({
    code: "AI_BUDGET_EXCEEDED",
  });
  await expect(
    createGeminiProvider(config, fetcher, reservation).generate("", {}, {}),
  ).rejects.toMatchObject({ code: "AI_BUDGET_EXCEEDED" });
  expect(reservation).toHaveBeenCalledTimes(1);
  expect(fetcher).not.toHaveBeenCalled();
  await expect(
    createGeminiProvider(
      loadAiConfig({ LLM_API_KEY: "fake", LLM_PRICING_VALID_UNTIL: "2000-01-01" }),
      fetcher,
      reservation,
    ).generate("", {}, {}),
  ).rejects.toMatchObject({ code: "AI_BUDGET_EXCEEDED" });
  expect(reservation).toHaveBeenCalledTimes(1);
});
it("rejects oversized input before making a reservation or sending private text", async () => {
  const fetcher = vi.fn(),
    reservation = vi.fn(async () => true);
  await expect(
    createGeminiProvider(loadAiConfig({ LLM_API_KEY: "fake" }), fetcher, reservation).generate(
      "",
      { text: "x".repeat(65536) },
      {},
    ),
  ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  expect(fetcher).not.toHaveBeenCalled();
  expect(reservation).not.toHaveBeenCalled();
});
