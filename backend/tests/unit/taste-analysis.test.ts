import { describe, it, expect, vi } from "vitest";
import { loadAiConfig } from "../../src/modules/ai/ai.config.js";
import { createGeminiProvider } from "../../src/modules/ai/ai.provider.js";
import { validateAnalysis } from "../../src/modules/taste-analysis/taste-analysis.schema.js";
const empty = { fields: [], allergies: [], diets: [], cuisines: [], dishes: [], questions: [] };
const catalogs = {
  allergens: [{ id: "1", code: "PEANUT", name: "Peanut" }],
  diets: [],
  cuisines: [],
};
describe("taste analysis contracts", () => {
  it("rejects invalid config, unsafe model URLs and leases shorter than the deadline", () => {
    expect(() => loadAiConfig({ LLM_MODEL: "../secret" })).toThrow();
    expect(() => loadAiConfig({ JOB_LEASE_SECONDS: "30", LLM_TIMEOUT_MS: "60000" })).toThrow();
    expect(() => loadAiConfig({ LLM_PROVIDER: "made-up" })).toThrow();
    expect(() => loadAiConfig({ WORKER_ENABLED: "yes" })).toThrow();
  });
  it("accepts only supported catalog facts with exact source evidence", () => {
    const result = { ...empty, allergies: [{ code: "PEANUT", evidence: "đậu phộng" }] };
    expect(validateAnalysis(result, "Dị ứng đậu phộng", catalogs)).toEqual(result);
    expect(() => validateAnalysis(result, "Thích cơm", catalogs)).toThrow("AI_INVALID_OUTPUT");
    expect(() =>
      validateAnalysis(
        { ...result, allergies: [{ code: "INVENTED", evidence: "đậu phộng" }] },
        "đậu phộng",
        catalogs,
      ),
    ).toThrow();
    expect(() =>
      validateAnalysis({ ...empty, arbitrary: "instruction" }, "Thích cơm", catalogs),
    ).toThrow();
  });
  it("rejects reversed budgets, duplicate fields and invented coordinates", () => {
    const field = { field: "budgetMin", value: "50000", evidence: "50k" };
    expect(() => validateAnalysis({ ...empty, fields: [field, field] }, "50k", catalogs)).toThrow();
    expect(() =>
      validateAnalysis(
        { ...empty, fields: [field, { field: "budgetMax", value: "10000", evidence: "10k" }] },
        "50k 10k",
        catalogs,
      ),
    ).toThrow();
    expect(() =>
      validateAnalysis(
        { ...empty, fields: [{ field: "latitude", value: "10", evidence: "10" }] },
        "10",
        catalogs,
      ),
    ).toThrow();
  });
  it("uses the official structured contract and keeps keys in request headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            { finishReason: "STOP", content: { parts: [{ text: JSON.stringify(empty) }] } },
          ],
        }),
      ),
    );
    const provider = createGeminiProvider(
      loadAiConfig({ LLM_API_KEY: "test-private-key" }),
      fetcher,
      async () => true,
    );
    expect(await provider.generate("extract", { text: "meal" }, {})).toEqual(empty);
    expect(fetcher.mock.calls[0]![0]).not.toContain("test-private-key");
    const options = fetcher.mock.calls[0]![1];
    expect(options.headers["x-goog-api-key"]).toBe("test-private-key");
    expect(JSON.parse(options.body).generationConfig.responseFormat.text.mimeType).toBe(
      "application/json",
    );
  });
  it("fails closed for unconfigured, quota, blocked and oversized output", async () => {
    await expect(createGeminiProvider(loadAiConfig({})).generate("", {}, {})).rejects.toThrow(
      "AI_NOT_CONFIGURED",
    );
    for (const [response, code] of [
      [new Response("", { status: 429 }), "AI_QUOTA_EXCEEDED"],
      [
        new Response(JSON.stringify({ candidates: [{ finishReason: "SAFETY" }] })),
        "AI_INVALID_OUTPUT",
      ],
      [new Response("x".repeat(100001)), "AI_INVALID_OUTPUT"],
    ] as const) {
      await expect(
        createGeminiProvider(
          loadAiConfig({ LLM_API_KEY: "key" }),
          vi.fn().mockResolvedValue(response),
          async () => true,
        ).generate("", {}, {}),
      ).rejects.toThrow(code);
    }
  });
});
