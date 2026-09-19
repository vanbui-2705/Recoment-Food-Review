import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import {
  AllergenPresence,
  AllergySeverity,
  DishPreferenceValue,
  VerificationStatus,
} from "../../src/generated/prisma/enums.js";

describe("PostgreSQL integration", () => {
  let app: FastifyInstance;
  let profileUserId: string;
  let invalidProfileUserId: string;
  let allergenId: string;
  let dietaryRestrictionId: string;
  let cuisineId: string;
  let dishUserId: string;
  let dishId: string;
  let ingredientId: string;
  const email = `database-test-${randomUUID()}@rec-food.local`;
  const profileEmail = `profile-test-${randomUUID()}@rec-food.local`;
  const invalidProfileEmail = `invalid-profile-test-${randomUUID()}@rec-food.local`;
  const dishUserEmail = `dish-test-${randomUUID()}@rec-food.local`;
  const catalogSuffix = randomUUID();
  const allergenCode = `TEST_ALLERGEN_${catalogSuffix}`;
  const dietaryRestrictionCode = `TEST_DIET_${catalogSuffix}`;
  const cuisineCode = `TEST_CUISINE_${catalogSuffix}`;
  const ingredientCode = `TEST_INGREDIENT_${catalogSuffix}`;
  const dishSlug = `test-dish-${catalogSuffix}`;
  const normalizedAlias = `test dish alias ${catalogSuffix}`.toLowerCase();

  beforeAll(async () => {
    app = buildApp({ logger: false, database: true });
    await app.ready();

    const [profileUser, dishUser, invalidProfileUser, allergen, dietaryRestriction, cuisine] =
      await app.prisma.$transaction([
        app.prisma.user.create({
          data: {
            email: profileEmail,
            displayName: "Taste Profile Test",
            passwordHash: "not-a-real-password-hash",
          },
        }),
        app.prisma.user.create({
          data: {
            email: dishUserEmail,
            displayName: "Dish Test",
            passwordHash: "not-a-real-password-hash",
          },
        }),
        app.prisma.user.create({
          data: {
            email: invalidProfileEmail,
            displayName: "Invalid Profile Test",
            passwordHash: "not-a-real-password-hash",
          },
        }),
        app.prisma.allergen.create({ data: { code: allergenCode, name: "Test allergen" } }),
        app.prisma.dietaryRestriction.create({
          data: { code: dietaryRestrictionCode, name: "Test dietary restriction" },
        }),
        app.prisma.cuisine.create({ data: { code: cuisineCode, name: "Test cuisine" } }),
      ]);

    profileUserId = profileUser.id;
    invalidProfileUserId = invalidProfileUser.id;
    dishUserId = dishUser.id;
    allergenId = allergen.id;
    dietaryRestrictionId = dietaryRestriction.id;
    cuisineId = cuisine.id;

    const ingredient = await app.prisma.ingredient.create({
      data: { code: ingredientCode, name: "Test ingredient" },
    });
    ingredientId = ingredient.id;
  });

  afterAll(async () => {
    if (app.hasDecorator("prisma")) {
      await app.prisma.dish.deleteMany({ where: { slug: { startsWith: `test-dish-` } } });
      await app.prisma.user.deleteMany({
        where: { email: { in: [email, profileEmail, invalidProfileEmail, dishUserEmail] } },
      });
      await app.prisma.ingredient.deleteMany({ where: { code: ingredientCode } });
      await app.prisma.allergen.deleteMany({ where: { code: allergenCode } });
      await app.prisma.dietaryRestriction.deleteMany({
        where: { code: dietaryRestrictionCode },
      });
      await app.prisma.cuisine.deleteMany({ where: { code: cuisineCode } });
    }
    await app.close();
  });

  it("kết nối được PostgreSQL", async () => {
    const result = await app.prisma.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`;

    expect(result[0]?.value).toBe(1);
  });

  it("enforce unique email", async () => {
    const data = {
      email,
      displayName: "Database Test",
      passwordHash: "not-a-real-password-hash",
    };

    await app.prisma.user.create({ data });

    await expect(app.prisma.user.create({ data })).rejects.toThrow();
  });

  it("lưu taste profile và các lựa chọn catalog không trùng", async () => {
    const tasteProfileData = {
      userId: profileUserId,
      spicyLevel: 70,
      sweetLevel: 40,
      sourLevel: 55,
      saltyLevel: 60,
      budgetMin: 30_000,
      budgetMax: 150_000,
      maxDistanceMeters: 5_000,
      onboardingCompleted: true,
    };

    await app.prisma.tasteProfile.create({ data: tasteProfileData });
    await app.prisma.userAllergy.create({
      data: {
        userId: profileUserId,
        allergenId,
        severity: AllergySeverity.SEVERE,
        notes: "Hard constraint test",
      },
    });
    await app.prisma.userDietaryRestriction.create({
      data: { userId: profileUserId, dietaryRestrictionId, isMandatory: true },
    });
    await app.prisma.userCuisinePreference.create({
      data: { userId: profileUserId, cuisineId, preferenceScore: 80 },
    });

    await expect(app.prisma.tasteProfile.create({ data: tasteProfileData })).rejects.toThrow();
    await expect(
      app.prisma.userAllergy.create({
        data: { userId: profileUserId, allergenId },
      }),
    ).rejects.toThrow();

    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: profileUserId },
      include: {
        tasteProfile: true,
        allergies: true,
        dietaryRestrictions: true,
        cuisinePreferences: true,
      },
    });

    expect(user.tasteProfile?.onboardingCompleted).toBe(true);
    expect(user.allergies).toHaveLength(1);
    expect(user.dietaryRestrictions[0]?.isMandatory).toBe(true);
    expect(user.cuisinePreferences[0]?.preferenceScore).toBe(80);
  });

  it.each([
    ["điểm vị giác", { spicyLevel: 101 }],
    ["ngân sách âm", { budgetMin: -1 }],
    ["ngân sách đảo ngược", { budgetMin: 200_000, budgetMax: 100_000 }],
    ["khoảng cách không dương", { maxDistanceMeters: 0 }],
  ])("từ chối %s ngoài constraint", async (_name, invalidValue) => {
    await expect(
      app.prisma.tasteProfile.create({
        data: {
          userId: invalidProfileUserId,
          spicyLevel: 50,
          sweetLevel: 50,
          sourLevel: 50,
          saltyLevel: 50,
          budgetMin: 30_000,
          budgetMax: 150_000,
          maxDistanceMeters: 5_000,
          ...invalidValue,
        },
      }),
    ).rejects.toThrow();
  });

  it("từ chối cuisine preference ngoài khoảng -100 đến 100", async () => {
    await expect(
      app.prisma.userCuisinePreference.create({
        data: { userId: invalidProfileUserId, cuisineId, preferenceScore: 101 },
      }),
    ).rejects.toThrow();
  });

  it("cascade dữ liệu taste profile khi xóa user", async () => {
    await app.prisma.user.delete({ where: { id: profileUserId } });

    const [profiles, allergies, diets, cuisinePreferences] = await app.prisma.$transaction([
      app.prisma.tasteProfile.count({ where: { userId: profileUserId } }),
      app.prisma.userAllergy.count({ where: { userId: profileUserId } }),
      app.prisma.userDietaryRestriction.count({ where: { userId: profileUserId } }),
      app.prisma.userCuisinePreference.count({ where: { userId: profileUserId } }),
    ]);

    expect({ profiles, allergies, diets, cuisinePreferences }).toEqual({
      profiles: 0,
      allergies: 0,
      diets: 0,
      cuisinePreferences: 0,
    });
  });

  it("lưu món hợp lệ và tìm theo slug hoặc alias chuẩn hóa", async () => {
    const dish = await app.prisma.dish.create({
      data: {
        slug: dishSlug,
        name: "Món thử nghiệm",
        cuisineId,
        priceMin: 25_000,
        priceMax: 75_000,
        spicyLevel: 20,
        sweetLevel: 30,
        sourLevel: 40,
        saltyLevel: 50,
        verificationStatus: VerificationStatus.REVIEWED,
        aliases: {
          create: { alias: "Test Dish Alias", normalizedAlias },
        },
      },
    });
    dishId = dish.id;

    const [bySlug, byAlias] = await app.prisma.$transaction([
      app.prisma.dish.findUnique({ where: { slug: dishSlug } }),
      app.prisma.dish.findMany({
        where: { aliases: { some: { normalizedAlias } } },
      }),
    ]);

    expect(bySlug?.id).toBe(dishId);
    expect(byAlias.map((item) => item.id)).toContain(dishId);
  });

  it.each([
    ["giá âm", { priceMin: -1 }],
    ["khoảng giá đảo ngược", { priceMin: 80_000, priceMax: 20_000 }],
    ["điểm vị giác", { spicyLevel: 101 }],
  ])("từ chối dish %s ngoài constraint", async (_name, invalidValue) => {
    await expect(
      app.prisma.dish.create({
        data: {
          slug: `invalid-${randomUUID()}`,
          name: "Invalid dish",
          cuisineId,
          priceMin: 20_000,
          priceMax: 80_000,
          spicyLevel: 50,
          sweetLevel: 50,
          sourLevel: 50,
          saltyLevel: 50,
          ...invalidValue,
        },
      }),
    ).rejects.toThrow();
  });

  it("enforce unique mappings, allergen evidence và một preference mỗi user-dish", async () => {
    await app.prisma.dishIngredient.create({
      data: { dishId, ingredientId, isPrimary: true },
    });
    await expect(
      app.prisma.dishIngredient.create({ data: { dishId, ingredientId } }),
    ).rejects.toThrow();
    await expect(
      app.prisma.dishAlias.create({
        data: { dishId, alias: "Duplicate Alias", normalizedAlias },
      }),
    ).rejects.toThrow();

    await expect(
      app.prisma.dishAllergen.create({
        data: {
          dishId,
          allergenId,
          presence: AllergenPresence.MAY_CONTAIN,
          evidenceSource: "   ",
        },
      }),
    ).rejects.toThrow();
    await expect(
      app.prisma.dishAllergen.create({
        data: {
          dishId,
          allergenId,
          presence: AllergenPresence.CONTAINS,
          verificationStatus: VerificationStatus.VERIFIED,
          evidenceSource: "Test evidence",
        },
      }),
    ).rejects.toThrow();

    await app.prisma.dishAllergen.create({
      data: {
        dishId,
        allergenId,
        presence: AllergenPresence.CONTAINS,
        verificationStatus: VerificationStatus.REVIEWED,
        evidenceSource: "Database integration test evidence",
      },
    });
    await expect(
      app.prisma.dishAllergen.create({
        data: {
          dishId,
          allergenId,
          presence: AllergenPresence.CONTAINS,
          evidenceSource: "Duplicate evidence",
        },
      }),
    ).rejects.toThrow();

    await app.prisma.userDishPreference.create({
      data: { userId: dishUserId, dishId, preference: DishPreferenceValue.LIKED },
    });
    await app.prisma.userDishPreference.update({
      where: { userId_dishId: { userId: dishUserId, dishId } },
      data: { preference: DishPreferenceValue.DISLIKED },
    });

    const preferences = await app.prisma.userDishPreference.findMany({
      where: { userId: dishUserId, dishId },
    });
    expect(preferences).toHaveLength(1);
    expect(preferences[0]?.preference).toBe(DishPreferenceValue.DISLIKED);
  });

  it("restrict catalog deletion và cascade dữ liệu thuộc dish", async () => {
    await expect(app.prisma.ingredient.delete({ where: { id: ingredientId } })).rejects.toThrow();
    await expect(app.prisma.allergen.delete({ where: { id: allergenId } })).rejects.toThrow();

    await app.prisma.dish.delete({ where: { id: dishId } });

    const [aliases, ingredientMappings, allergenMappings, preferences] =
      await app.prisma.$transaction([
        app.prisma.dishAlias.count({ where: { dishId } }),
        app.prisma.dishIngredient.count({ where: { dishId } }),
        app.prisma.dishAllergen.count({ where: { dishId } }),
        app.prisma.userDishPreference.count({ where: { dishId } }),
      ]);

    expect({ aliases, ingredientMappings, allergenMappings, preferences }).toEqual({
      aliases: 0,
      ingredientMappings: 0,
      allergenMappings: 0,
      preferences: 0,
    });
  });
});
