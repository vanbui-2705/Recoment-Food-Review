import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { normalizeFoodText, type DishWrite } from "./food.schema.js";
export const dishInclude = {
  cuisine: true,
  aliases: true,
  ingredients: { include: { ingredient: true } },
  allergens: { include: { allergen: true } },
} as const;
export function createFoodRepository(prisma: PrismaClient) {
  return {
    async save(id: string | undefined, input: DishWrite) {
      if (input.priceMin > input.priceMax)
        throw new AppError(400, "INVALID_PRICE", "Khoảng giá không hợp lệ");
      const normalizedAliases = input.aliases.map(normalizeFoodText);
      if (
        normalizedAliases.some((a) => !a) ||
        new Set(normalizedAliases).size !== normalizedAliases.length ||
        new Set(input.allergens.map((a) => a.code)).size !== input.allergens.length
      )
        throw new AppError(
          400,
          "DUPLICATE_SELECTION",
          "Tên gọi hoặc dị nguyên bị trùng/không hợp lệ",
        );
      if (!input.evidenceSource.trim())
        throw new AppError(400, "INVALID_EVIDENCE", "Nguồn kiến thức không được trống");
      return prisma
        .$transaction(async (tx) => {
          const cuisine = await tx.cuisine.findUnique({ where: { code: input.cuisineCode } });
          const ingredients = await tx.ingredient.findMany({
            where: { code: { in: input.ingredientCodes } },
          });
          const allergens = await tx.allergen.findMany({
            where: { code: { in: input.allergens.map((a) => a.code) } },
          });
          const diets = await tx.dietaryRestriction.count({
            where: { code: { in: input.dietaryCodes } },
          });
          if (
            !cuisine ||
            ingredients.length !== input.ingredientCodes.length ||
            allergens.length !== input.allergens.length ||
            diets !== input.dietaryCodes.length
          )
            throw new AppError(400, "UNKNOWN_CATALOG_CODE", "Mã kiến thức món ăn không tồn tại");
          if (id && !(await tx.dish.findUnique({ where: { id } })))
            throw new AppError(404, "DISH_NOT_FOUND", "Không tìm thấy món");
          const { aliases, allergens: allergenSelections } = input;
          const fields = {
            slug: input.slug,
            name: input.name,
            description: input.description,
            priceMin: input.priceMin,
            priceMax: input.priceMax,
            spicyLevel: input.spicyLevel,
            sweetLevel: input.sweetLevel,
            sourLevel: input.sourLevel,
            saltyLevel: input.saltyLevel,
            verificationStatus: input.verificationStatus,
            evidenceSource: input.evidenceSource,
            dietaryCodes: input.dietaryCodes,
            mealPeriods: input.mealPeriods,
          };
          const data = { ...fields, name: input.name.trim(), cuisineId: cuisine.id };
          if (!data.name) throw new AppError(400, "INVALID_NAME", "Tên món không được trống");
          const dish = id
            ? await tx.dish.update({ where: { id }, data })
            : await tx.dish.create({ data });
          await tx.dishAlias.deleteMany({ where: { dishId: dish.id } });
          await tx.dishIngredient.deleteMany({ where: { dishId: dish.id } });
          await tx.dishAllergen.deleteMany({ where: { dishId: dish.id } });
          await tx.dishAlias.createMany({
            data: aliases.map((alias, i) => ({
              dishId: dish.id,
              alias,
              normalizedAlias: normalizedAliases[i]!,
            })),
          });
          await tx.dishIngredient.createMany({
            data: ingredients.map((ingredient) => ({
              dishId: dish.id,
              ingredientId: ingredient.id,
            })),
          });
          await tx.dishAllergen.createMany({
            data: allergenSelections.map((a) => ({
              dishId: dish.id,
              allergenId: allergens.find((row) => row.code === a.code)!.id,
              presence: a.presence,
              verificationStatus: input.verificationStatus,
              evidenceSource: input.evidenceSource,
              verifiedAt: input.verificationStatus === "VERIFIED" ? new Date() : null,
            })),
          });
          return tx.dish.findUniqueOrThrow({ where: { id: dish.id }, include: dishInclude });
        })
        .catch((error: unknown) => {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
          )
            throw new AppError(409, "DISH_CONFLICT", "Slug món ăn đã tồn tại");
          throw error;
        });
    },
  };
}
