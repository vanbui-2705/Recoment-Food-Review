import { Type, type Static } from "@fastify/type-provider-typebox";
const level = Type.Integer({ minimum: 0, maximum: 100 });
const code = Type.String({ minLength: 1, maxLength: 80, pattern: "^[A-Z0-9_]+$" });
export const DishIdSchema = Type.Object(
  { id: Type.String({ format: "uuid" }) },
  { additionalProperties: false },
);
export const DishWriteSchema = Type.Object(
  {
    slug: Type.String({ minLength: 1, maxLength: 120, pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" }),
    name: Type.String({ minLength: 1, maxLength: 150 }),
    description: Type.String({ maxLength: 3000 }),
    cuisineCode: code,
    priceMin: Type.Integer({ minimum: 0, maximum: 100000000 }),
    priceMax: Type.Integer({ minimum: 0, maximum: 100000000 }),
    spicyLevel: level,
    sweetLevel: level,
    sourLevel: level,
    saltyLevel: level,
    verificationStatus: Type.Union([
      Type.Literal("UNVERIFIED"),
      Type.Literal("REVIEWED"),
      Type.Literal("VERIFIED"),
    ]),
    evidenceSource: Type.String({ minLength: 1, maxLength: 500 }),
    dietaryCodes: Type.Array(code, { maxItems: 50, uniqueItems: true }),
    mealPeriods: Type.Array(
      Type.Union([
        Type.Literal("BREAKFAST"),
        Type.Literal("LUNCH"),
        Type.Literal("DINNER"),
        Type.Literal("SNACK"),
        Type.Literal("LATE_NIGHT"),
      ]),
      { maxItems: 5, uniqueItems: true },
    ),
    aliases: Type.Array(Type.String({ minLength: 1, maxLength: 150 }), { maxItems: 30 }),
    ingredientCodes: Type.Array(code, { maxItems: 100, uniqueItems: true }),
    allergens: Type.Array(
      Type.Object(
        { code, presence: Type.Union([Type.Literal("CONTAINS"), Type.Literal("MAY_CONTAIN")]) },
        { additionalProperties: false },
      ),
      { maxItems: 50 },
    ),
  },
  { additionalProperties: false },
);
export type DishWrite = Static<typeof DishWriteSchema>;
export function normalizeFoodText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
