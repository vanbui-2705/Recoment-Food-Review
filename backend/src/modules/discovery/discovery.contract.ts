import { Type, type Static } from "@fastify/type-provider-typebox";

// Shared foundation for P2/P3: venue content and verified merchant offers stay distinct.
export const SourceEvidenceSchema = Type.Object(
  {
    provider: Type.String({ minLength: 1, maxLength: 80 }),
    sourceUrl: Type.String({ pattern: "^https://", maxLength: 2000 }),
    observedAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);
export const RestaurantIdentitySchema = Type.Object(
  {
    provider: Type.String({ minLength: 1, maxLength: 80 }),
    externalId: Type.String({ minLength: 1, maxLength: 255 }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    latitude: Type.Number({ minimum: -90, maximum: 90 }),
    longitude: Type.Number({ minimum: -180, maximum: 180 }),
  },
  { additionalProperties: false },
);
export const MerchantOfferSchema = Type.Object(
  {
    externalOfferId: Type.String({ minLength: 1, maxLength: 255 }),
    restaurant: RestaurantIdentitySchema,
    title: Type.String({ minLength: 1, maxLength: 200 }),
    price: Type.Integer({ minimum: 0, maximum: 100000000 }),
    currency: Type.Literal("VND"),
    isAvailable: Type.Boolean(),
    evidence: SourceEvidenceSchema,
    safety: Type.Union([
      Type.Literal("UNKNOWN"),
      Type.Literal("VERIFIED"),
      Type.Literal("CONFLICTING"),
      Type.Literal("EXPIRED"),
    ]),
  },
  { additionalProperties: false },
);
export const DiscoveryCandidateSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("MERCHANT_OFFER"),
      offer: MerchantOfferSchema,
      budgetVerified: Type.Literal(true),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("UNPRICED_VENUE"),
      restaurant: RestaurantIdentitySchema,
      price: Type.Null(),
      budgetVerified: Type.Literal(false),
    },
    { additionalProperties: false },
  ),
]);
export type MerchantOffer = Static<typeof MerchantOfferSchema>;
export type DiscoveryCandidate = Static<typeof DiscoveryCandidateSchema>;
export const DISCOVERY_ERROR_CODES = [
  "NOT_CONFIGURED",
  "UNAVAILABLE",
  "NO_MATCH",
  "INSUFFICIENT_SAFETY_DATA",
  "PROFILE_PENDING_ANALYSIS",
  "LOCATION_REQUIRED",
] as const;
