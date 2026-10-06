import { describe, expect, it } from "vitest";
import { AiError } from "../../src/modules/ai/ai.provider.js";
import {
  loadRankingWeights,
  normalizedScore,
  diversify,
  validateRerank,
  rerank,
} from "../../src/modules/recommendations/recommendation.policy.js";
const id = "0d4fccce-61b9-43af-b8c3-baf6d687eb18",
  other = "e9f74ba8-7378-4b9f-ad6e-fd71b6d4ae22";
const candidates = [
  {
    id,
    dishId: "dish1",
    restaurantId: "restaurant1",
    score: 80,
    reasons: ["BUDGET_MATCH", "NEARBY"],
  },
  { id: other, dishId: "dish2", restaurantId: "restaurant2", score: 70, reasons: ["BUDGET_MATCH"] },
];
describe("bounded recommendation ranking", () => {
  it("normalizes scores, clamps inputs and rejects invalid weights", () => {
    const weights = loadRankingWeights({});
    expect(
      normalizedScore(
        { taste: 1, cuisine: 1, distance: 1, budget: 1, rating: 1, novelty: 1 },
        weights,
      ),
    ).toBe(100);
    expect(
      normalizedScore(
        { taste: -1, cuisine: -1, distance: -1, budget: -1, rating: -1, novelty: -1 },
        weights,
      ),
    ).toBe(0);
    expect(() => loadRankingWeights({ RECOMMENDATION_WEIGHT_TASTE: "101" })).toThrow();
  });
  it("uses stable ties and promotes different dishes and venues without discarding candidates", () => {
    const sameDish = { ...candidates[0]!, id: "z", score: 90 };
    expect(diversify([sameDish, ...candidates]).map((item) => item.id)).toEqual(["z", other, id]);
    expect(
      diversify([{ ...candidates[1]!, score: 80 }, candidates[0]!]).map((item) => item.id),
    ).toEqual([id, other]);
  });
  it("rejects invented IDs, incomplete sets, duplicate IDs, unsupported facts and free-text claims", () => {
    expect(() =>
      validateRerank(
        {
          items: [
            { id: "a55f880d-3d17-4a55-b088-533493723117", reasonCodes: ["NEARBY"] },
            { id: other, reasonCodes: ["BUDGET_MATCH"] },
          ],
        },
        candidates,
      ),
    ).toThrow();
    expect(() =>
      validateRerank(
        {
          items: [
            { id, reasonCodes: ["LIKED"] },
            { id: other, reasonCodes: ["BUDGET_MATCH"] },
          ],
        },
        candidates,
      ),
    ).toThrow();
    expect(() =>
      validateRerank({ items: [{ id, reasonCodes: ["NEARBY"] }] }, candidates),
    ).toThrow();
    expect(() =>
      validateRerank(
        {
          items: [
            { id, reasonCodes: ["NEARBY"] },
            { id, reasonCodes: ["NEARBY"] },
          ],
        },
        candidates,
      ),
    ).toThrow();
    expect(() =>
      validateRerank(
        {
          items: [
            { id, reasonCodes: ["NEARBY"], reason: "Allergy safe for 1 VND" },
            { id: other, reasonCodes: ["BUDGET_MATCH"] },
          ],
        },
        candidates,
      ),
    ).toThrow();
  });
  it("falls back without losing valid candidates on quota or malformed model output", async () => {
    const provider = { model: "test", configured: true, generate: async () => ({ items: [] }) };
    expect(await rerank(candidates, provider, async () => true)).toEqual({
      items: candidates,
      status: "FALLBACK_AI_INVALID_OUTPUT",
    });
    expect(await rerank(candidates, provider, async () => false)).toEqual({
      items: candidates,
      status: "FALLBACK_QUOTA",
    });
    expect(
      await rerank(
        candidates,
        {
          ...provider,
          generate: async () => {
            throw new AiError("AI_BUDGET_EXCEEDED");
          },
        },
        async () => true,
      ),
    ).toEqual({ items: candidates, status: "FALLBACK_AI_BUDGET_EXCEEDED" });
  });
});
