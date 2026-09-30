import { Type, type Static } from "@fastify/type-provider-typebox";

const CatalogCodeSchema = Type.String({ minLength: 1, maxLength: 50 });
const DescriptionSchema = Type.Union([Type.String(), Type.Null()]);
const AllergySeveritySchema = Type.Union([
  Type.Literal("UNKNOWN"),
  Type.Literal("MILD"),
  Type.Literal("MODERATE"),
  Type.Literal("SEVERE"),
]);

export const AllergySelectionSchema = Type.Object(
  {
    code: CatalogCodeSchema,
    severity: AllergySeveritySchema,
    notes: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  },
  { additionalProperties: false },
);

export const DietaryRestrictionSelectionSchema = Type.Object(
  {
    code: CatalogCodeSchema,
    isMandatory: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const CuisinePreferenceSelectionSchema = Type.Object(
  {
    code: CatalogCodeSchema,
    preferenceScore: Type.Integer({ minimum: -100, maximum: 100 }),
  },
  { additionalProperties: false },
);

export const ProfilePayloadSchema = Type.Object(
  {
    spicyLevel: Type.Integer({ minimum: 0, maximum: 100 }),
    sweetLevel: Type.Integer({ minimum: 0, maximum: 100 }),
    sourLevel: Type.Integer({ minimum: 0, maximum: 100 }),
    saltyLevel: Type.Integer({ minimum: 0, maximum: 100 }),
    budgetMin: Type.Integer({ minimum: 0, maximum: 100_000_000 }),
    budgetMax: Type.Integer({ minimum: 0, maximum: 100_000_000 }),
    maxDistanceMeters: Type.Integer({ minimum: 1, maximum: 100_000 }),
    allergies: Type.Array(AllergySelectionSchema, { maxItems: 50 }),
    dietaryRestrictions: Type.Array(DietaryRestrictionSelectionSchema, { maxItems: 50 }),
    cuisinePreferences: Type.Array(CuisinePreferenceSelectionSchema, { maxItems: 50 }),
  },
  { additionalProperties: false },
);

export const CatalogItemSchema = Type.Object(
  {
    code: CatalogCodeSchema,
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: DescriptionSchema,
  },
  { additionalProperties: false },
);

export const AllergyResponseSchema = Type.Object(
  {
    code: CatalogCodeSchema,
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: DescriptionSchema,
    severity: AllergySeveritySchema,
    notes: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
  },
  { additionalProperties: false },
);

export const DietaryRestrictionResponseSchema = Type.Object(
  {
    code: CatalogCodeSchema,
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: DescriptionSchema,
    isMandatory: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const CuisinePreferenceResponseSchema = Type.Object(
  {
    code: CatalogCodeSchema,
    name: Type.String({ minLength: 1, maxLength: 100 }),
    description: DescriptionSchema,
    preferenceScore: Type.Integer({ minimum: -100, maximum: 100 }),
  },
  { additionalProperties: false },
);

export const TasteProfileResponseSchema = Type.Object(
  {
    spicyLevel: Type.Integer({ minimum: 0, maximum: 100 }),
    sweetLevel: Type.Integer({ minimum: 0, maximum: 100 }),
    sourLevel: Type.Integer({ minimum: 0, maximum: 100 }),
    saltyLevel: Type.Integer({ minimum: 0, maximum: 100 }),
    budgetMin: Type.Integer({ minimum: 0 }),
    budgetMax: Type.Integer({ minimum: 0 }),
    maxDistanceMeters: Type.Integer({ minimum: 1 }),
    onboardingCompleted: Type.Boolean(),
    allergies: Type.Array(AllergyResponseSchema, { maxItems: 50 }),
    dietaryRestrictions: Type.Array(DietaryRestrictionResponseSchema, { maxItems: 50 }),
    cuisinePreferences: Type.Array(CuisinePreferenceResponseSchema, { maxItems: 50 }),
  },
  { additionalProperties: false },
);

export const ProfileResponseSchema = Type.Object(
  {
    data: Type.Object(
      { profile: Type.Union([TasteProfileResponseSchema, Type.Null()]) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const CatalogResponseSchema = Type.Object(
  {
    data: Type.Object({ items: Type.Array(CatalogItemSchema, { maxItems: 500 }) }, { additionalProperties: false }),
  },
  { additionalProperties: false },
);

export type ProfilePayload = Static<typeof ProfilePayloadSchema>;
export type AllergySelection = Static<typeof AllergySelectionSchema>;
export type DietaryRestrictionSelection = Static<typeof DietaryRestrictionSelectionSchema>;
export type CuisinePreferenceSelection = Static<typeof CuisinePreferenceSelectionSchema>;
