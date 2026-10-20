import { describe, expect, it } from "vitest";
import {
  behavioralAdjustment,
  buildBehavioralSnapshot,
  type BehavioralDish,
} from "../../src/modules/food/behavioral-personalization.policy.js";

const now = new Date("2026-10-13T00:00:00.000Z");
const vietnamese: BehavioralDish = {
  id: "pho",
  cuisineCode: "VIETNAMESE",
  priceMin: 40_000,
  priceMax: 80_000,
  spicyLevel: 20,
  sweetLevel: 20,
  sourLevel: 10,
  saltyLevel: 45,
};
const similar = { ...vietnamese, id: "bun", spicyLevel: 25, priceMax: 90_000 };
const distant = {
  ...vietnamese,
  id: "wagyu",
  cuisineCode: "JAPANESE",
  priceMin: 450_000,
  priceMax: 900_000,
  spicyLevel: 0,
  sweetLevel: 55,
  sourLevel: 0,
  saltyLevel: 20,
};

describe("behavioral food personalization", () => {
  it("weights explicit and outcome signals above views and propagates to similar dishes", () => {
    const dishes = [vietnamese, similar, distant];
    const view = buildBehavioralSnapshot(
      dishes,
      [{ id: "v", dishId: "pho", type: "VIEWED", rating: null, at: now }],
      [],
      now,
    );
    const liked = buildBehavioralSnapshot(
      dishes,
      [{ id: "l", dishId: "pho", type: "LIKED", rating: null, at: now }],
      [{ dishId: "pho", preference: "LIKED", updatedAt: now }],
      now,
    );
    expect(behavioralAdjustment(similar, liked).adjustment).toBeGreaterThan(
      behavioralAdjustment(similar, view).adjustment,
    );
    expect(behavioralAdjustment(similar, liked).adjustment).toBeGreaterThan(
      behavioralAdjustment(distant, liked).adjustment,
    );
    expect(behavioralAdjustment(similar, liked).reasonCode).toContain("MATCH");
  });

  it("decays old feedback and applies negative signals", () => {
    const recent = buildBehavioralSnapshot(
      [vietnamese, similar],
      [{ id: "new", dishId: "pho", type: "SKIPPED", rating: null, at: now }],
      [],
      now,
    );
    const old = buildBehavioralSnapshot(
      [vietnamese, similar],
      [
        {
          id: "old",
          dishId: "pho",
          type: "SKIPPED",
          rating: null,
          at: new Date(+now - 180 * 86_400_000),
        },
      ],
      [],
      now,
    );
    expect(behavioralAdjustment(similar, recent).adjustment).toBeLessThan(0);
    expect(Math.abs(behavioralAdjustment(similar, old).adjustment)).toBeLessThan(
      Math.abs(behavioralAdjustment(similar, recent).adjustment),
    );
  });

  it("caps repeated evidence and reports cold-start confidence", () => {
    const events = Array.from({ length: 100 }, (_, index) => ({
      id: String(index).padStart(3, "0"),
      dishId: "pho",
      type: "EATEN" as const,
      rating: null,
      at: new Date(+now - index * 1000),
    }));
    const cold = buildBehavioralSnapshot([vietnamese], [], [], now);
    const learned = buildBehavioralSnapshot([vietnamese], events, [], now);
    expect(cold.confidence).toBe("COLD_START");
    expect(cold.sampleSize).toBe(0);
    expect(learned.sampleSize).toBe(3);
    expect(behavioralAdjustment(vietnamese, learned).adjustment).toBeLessThanOrEqual(24);
  });
});
