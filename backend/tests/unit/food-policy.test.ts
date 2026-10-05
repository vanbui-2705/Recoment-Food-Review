import { describe, expect, it } from "vitest";
import { candidateAllowed, candidateScore } from "../../src/modules/food/food.service.js";
import {
  distanceMeters,
  isCoolingDown,
  REPEAT_WINDOW_MS,
} from "../../src/modules/food/food.policy.js";
import { normalizeFoodText } from "../../src/modules/food/food.schema.js";
const profile = {
  spicyLevel: 20,
  sweetLevel: 20,
  sourLevel: 20,
  saltyLevel: 20,
  budgetMin: 0,
  budgetMax: 100000,
  maxDistanceMeters: 3000,
  onboardingCompleted: true,
  allergies: [],
  dietaryRestrictions: [],
  cuisinePreferences: [],
};
const dish = {
  id: "dish",
  priceMin: 30000,
  priceMax: 60000,
  verificationStatus: "REVIEWED",
  evidenceSource: null,
  dietaryCodes: [],
  mealPeriods: [],
  spicyLevel: 20,
  sweetLevel: 20,
  sourLevel: 20,
  saltyLevel: 20,
  cuisine: { code: "VIETNAMESE" },
};
describe("food recommendation policy", () => {
  it("expires precisely at 96 hours, across month and year boundaries", () => {
    const eaten = new Date("2026-12-30T23:00:00Z");
    expect(isCoolingDown(eaten, new Date(eaten.getTime() + REPEAT_WINDOW_MS - 1))).toBe(true);
    expect(isCoolingDown(eaten, new Date(eaten.getTime() + REPEAT_WINDOW_MS))).toBe(false);
  });
  it("excludes dislikes, recent choices, and ranges exceeding the budget", () => {
    expect(candidateAllowed(dish, profile, new Set(), new Set())).toBe(true);
    expect(candidateAllowed(dish, profile, new Set([dish.id]), new Set())).toBe(false);
    expect(candidateAllowed(dish, profile, new Set(), new Set([dish.id]))).toBe(false);
    expect(candidateAllowed({ ...dish, priceMax: 100001 }, profile, new Set(), new Set())).toBe(
      false,
    );
  });
  it("fails closed for allergies and unverified mandatory dietary constraints", () => {
    expect(
      candidateAllowed(
        dish,
        {
          ...profile,
          allergies: [
            { code: "FISH", name: "Fish", description: null, severity: "MILD", notes: null },
          ],
        },
        new Set(),
        new Set(),
      ),
    ).toBe(false);
    const vegan = {
      ...profile,
      dietaryRestrictions: [{ code: "VEGAN", name: "Vegan", description: null, isMandatory: true }],
    };
    expect(
      candidateAllowed({ ...dish, dietaryCodes: ["VEGAN"] }, vegan, new Set(), new Set()),
    ).toBe(false);
    expect(
      candidateAllowed(
        {
          ...dish,
          verificationStatus: "VERIFIED",
          dietaryCodes: ["VEGAN"],
          evidenceSource: "Merchant reviewed recipe",
        },
        vegan,
        new Set(),
        new Set(),
      ),
    ).toBe(true);
    expect(
      candidateAllowed(
        { ...dish, verificationStatus: "VERIFIED", dietaryCodes: ["VEGAN"] },
        vegan,
        new Set(),
        new Set(),
      ),
    ).toBe(false);
  });
  it("respects meal metadata and ranks taste and explicit likes", () => {
    expect(
      candidateAllowed(
        { ...dish, mealPeriods: ["DINNER"] },
        { ...profile, mealPeriod: "BREAKFAST" },
        new Set(),
        new Set(),
      ),
    ).toBe(false);
    expect(candidateScore(dish, profile, new Set([dish.id]))).toBeGreaterThan(
      candidateScore(dish, profile, new Set()),
    );
    expect(candidateScore(dish, profile, new Set())).toBeGreaterThan(
      candidateScore({ ...dish, spicyLevel: 100 }, profile, new Set()),
    );
  });
  it("normalizes Vietnamese names and calculates geographic distance", () => {
    expect(normalizeFoodText("  BÚN đậu  ")).toBe("bun dau");
    expect(distanceMeters({ latitude: 10, longitude: 106 }, { latitude: 10, longitude: 106 })).toBe(
      0,
    );
    expect(
      distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }),
    ).toBeGreaterThan(111000);
  });
});
