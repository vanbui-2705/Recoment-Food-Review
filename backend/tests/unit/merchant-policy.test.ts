import { describe, expect, it } from "vitest";
import {
  validateMenuRow,
  evidenceUrl,
  checkFreshness,
} from "../../src/modules/merchant-menu/merchant.schema.js";
import { safetyDecision, type SafetyFact } from "../../src/modules/merchant-menu/safety.policy.js";
const now = new Date("2026-10-06T12:00:00Z");
const future = new Date(+now + 3600000);
describe("merchant evidence contracts", () => {
  it("rejects invented currencies, credentials in provenance and invalid evidence lifetimes", () => {
    const row = {
      restaurant: {
        externalId: "r",
        name: "Quán",
        address: "Địa chỉ",
        latitude: 10,
        longitude: 106,
      },
      externalId: "o",
      title: "Phở",
      price: 40000,
      currency: "VND",
      isAvailable: true,
      sourceUrl: "https://merchant.test/menu",
      observedAt: now.toISOString(),
      expiresAt: future.toISOString(),
    };
    expect(validateMenuRow(row, 24, now)).toEqual(row);
    expect(() => validateMenuRow({ ...row, currency: "USD" }, 24, now)).toThrow();
    expect(() => validateMenuRow({ ...row, price: 0.1 }, 24, now)).toThrow();
    expect(() => validateMenuRow({ ...row, title: " " }, 24, now)).toThrow();
    expect(() => evidenceUrl("https://merchant.test/menu?api_key=private")).toThrow();
    expect(() => evidenceUrl("https://name:password@merchant.test/menu")).toThrow();
    expect(() =>
      checkFreshness(now.toISOString(), new Date(+now + 25 * 3600000).toISOString(), 24, now),
    ).toThrow();
    expect(() => checkFreshness(now.toISOString(), now.toISOString(), 24, now)).toThrow();
  });
  it("requires explicit absence and cross-contact evidence for every allergy and positive diet evidence", () => {
    const fact = (kind: string, code: string, claim: string): SafetyFact => ({
      kind,
      code,
      claim,
      status: "APPROVED",
      observedAt: now,
      expiresAt: future,
    });
    const constraints = { allergies: ["PEANUT"], diets: ["VEGAN"] };
    const valid = [
      fact("ALLERGEN", "PEANUT", "ABSENT"),
      fact("CROSS_CONTACT", "PEANUT", "ABSENT"),
      fact("DIET", "VEGAN", "PRESENT"),
    ];
    expect(safetyDecision([], constraints, now).eligible).toBe(false);
    expect(safetyDecision(valid.slice(0, 1), constraints, now).eligible).toBe(false);
    expect(safetyDecision(valid, constraints, now).eligible).toBe(true);
    expect(
      safetyDecision([...valid, fact("ALLERGEN", "PEANUT", "PRESENT")], constraints, now).eligible,
    ).toBe(false);
    expect(
      safetyDecision(
        valid.map((f) => ({ ...f, expiresAt: now })),
        constraints,
        now,
      ).eligible,
    ).toBe(false);
    expect(
      safetyDecision(
        valid.map((f) => ({ ...f, status: "PENDING" })),
        constraints,
        now,
      ).eligible,
    ).toBe(false);
    expect(
      safetyDecision([...valid, { ...valid[0]!, status: "PENDING" }], constraints, now).eligible,
    ).toBe(false);
    expect(safetyDecision(valid, constraints, now, new Date(+now + 1)).eligible).toBe(false);
    expect(
      safetyDecision(
        valid.map((f) => ({ ...f, claim: "UNKNOWN" })),
        constraints,
        now,
      ).eligible,
    ).toBe(false);
  });
});
