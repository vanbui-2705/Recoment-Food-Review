import { Check } from "typebox/value";
import { expect, it } from "vitest";
import {
  DiscoveryCandidateSchema,
  MerchantOfferSchema,
} from "../../src/modules/discovery/discovery.contract.js";
const restaurant = {
  provider: "merchant-fixture",
  externalId: "restaurant1",
  name: "Fixture",
  latitude: 10.77,
  longitude: 106.7,
};
const offer = {
  externalOfferId: "regular-size",
  restaurant,
  title: "Phở",
  price: 45000,
  currency: "VND",
  isAvailable: true,
  safety: "UNKNOWN",
  evidence: {
    provider: "merchant-fixture",
    sourceUrl: "https://merchant.example/menu",
    observedAt: "2026-10-06T00:00:00Z",
    expiresAt: "2026-10-07T00:00:00Z",
  },
};
it("separates unknown-price venues from confirmed merchant offers", () => {
  const venue = { kind: "UNPRICED_VENUE", restaurant, price: null, budgetVerified: false };
  expect(Check(DiscoveryCandidateSchema, venue)).toBe(true);
  expect(Check(DiscoveryCandidateSchema, { ...venue, budgetVerified: true })).toBe(false);
  expect(
    Check(DiscoveryCandidateSchema, { kind: "MERCHANT_OFFER", offer, budgetVerified: true }),
  ).toBe(true);
  expect(Check(MerchantOfferSchema, { ...offer, currency: "USD" })).toBe(false);
  expect(
    Check(MerchantOfferSchema, {
      ...offer,
      evidence: { ...offer.evidence, sourceUrl: "DB04 seed" },
    }),
  ).toBe(false);
});
