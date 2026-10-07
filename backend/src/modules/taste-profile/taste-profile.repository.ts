import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ProfilePayload } from "./taste-profile.schema.js";

export type CatalogRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type StoredProfile = {
  profile: {
    latitude?: number | null;
    longitude?: number | null;
    areaLabel?: string | null;
    mealPeriod?: Exclude<ProfilePayload["mealPeriod"], undefined>;
    spicyLevel: number;
    sweetLevel: number;
    sourLevel: number;
    saltyLevel: number;
    budgetMin: number;
    budgetMax: number;
    maxDistanceMeters: number;
    onboardingCompleted: boolean;
  };
  allergies: Array<{
    code: string;
    name: string;
    description: string | null;
    severity: "UNKNOWN" | "MILD" | "MODERATE" | "SEVERE";
    notes: string | null;
  }>;
  dietaryRestrictions: Array<{
    code: string;
    name: string;
    description: string | null;
    isMandatory: boolean;
  }>;
  cuisinePreferences: Array<{
    code: string;
    name: string;
    description: string | null;
    preferenceScore: number;
  }>;
};

type ProfileDatabase = Pick<
  PrismaClient,
  "tasteProfile" | "userAllergy" | "userDietaryRestriction" | "userCuisinePreference"
>;

const allergyInclude = { allergen: true } as const;
const dietaryInclude = { dietaryRestriction: true } as const;
const cuisineInclude = { cuisine: true } as const;

/** Đọc profile và các relation, sau đó sắp xếp theo code public ổn định. */
async function findStoredProfile(
  db: ProfileDatabase,
  userId: string,
): Promise<StoredProfile | null> {
  // A transaction uses one connection; execute its queries sequentially.
  const profile = await db.tasteProfile.findUnique({ where: { userId } });
  const allergies = await db.userAllergy.findMany({ where: { userId }, include: allergyInclude });
  const dietaryRestrictions = await db.userDietaryRestriction.findMany({
    where: { userId },
    include: dietaryInclude,
  });
  const cuisinePreferences = await db.userCuisinePreference.findMany({
    where: { userId },
    include: cuisineInclude,
  });

  if (!profile) {
    return null;
  }

  return {
    profile,
    allergies: allergies
      .map((item) => ({
        code: item.allergen.code,
        name: item.allergen.name,
        description: item.allergen.description,
        severity: item.severity,
        notes: item.notes,
      }))
      .sort((left, right) => left.code.localeCompare(right.code)),
    dietaryRestrictions: dietaryRestrictions
      .map((item) => ({
        code: item.dietaryRestriction.code,
        name: item.dietaryRestriction.name,
        description: item.dietaryRestriction.description,
        isMandatory: item.isMandatory,
      }))
      .sort((left, right) => left.code.localeCompare(right.code)),
    cuisinePreferences: cuisinePreferences
      .map((item) => ({
        code: item.cuisine.code,
        name: item.cuisine.name,
        description: item.cuisine.description,
        preferenceScore: item.preferenceScore,
      }))
      .sort((left, right) => left.code.localeCompare(right.code)),
  };
}

/** Tạo repository chứa toàn bộ truy vấn Prisma cho taste profile. */
export function createTasteProfileRepository(prisma: PrismaClient) {
  return {
    /** Liệt kê allergen catalog theo code tăng dần. */
    async listAllergens(): Promise<CatalogRecord[]> {
      return prisma.allergen.findMany({ orderBy: { code: "asc" } });
    },

    /** Liệt kê dietary restriction catalog theo code tăng dần. */
    async listDietaryRestrictions(): Promise<CatalogRecord[]> {
      return prisma.dietaryRestriction.findMany({ orderBy: { code: "asc" } });
    },

    /** Liệt kê cuisine catalog theo code tăng dần. */
    async listCuisines(): Promise<CatalogRecord[]> {
      return prisma.cuisine.findMany({ orderBy: { code: "asc" } });
    },

    /** Đọc profile cùng các constraint của một user. */
    async findProfile(userId: string): Promise<StoredProfile | null> {
      return findStoredProfile(prisma, userId);
    },

    /** Ghi full replacement trong một transaction để không lưu trạng thái dở dang. */
    async replaceProfile(
      userId: string,
      input: ProfilePayload,
      resolved: {
        allergenIds: string[];
        dietaryRestrictionIds: string[];
        cuisineIds: string[];
      },
      markOnboardingCompleted: boolean,
    ): Promise<StoredProfile> {
      return prisma.$transaction(async (transaction) => {
        const currentProfile = await transaction.tasteProfile.findUnique({ where: { userId } });
        const onboardingCompleted =
          markOnboardingCompleted || currentProfile?.onboardingCompleted === true;

        await transaction.tasteProfile.upsert({
          where: { userId },
          update: {
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            areaLabel: input.areaLabel?.trim() || null,
            mealPeriod: input.mealPeriod ?? null,
            spicyLevel: input.spicyLevel,
            sweetLevel: input.sweetLevel,
            sourLevel: input.sourLevel,
            saltyLevel: input.saltyLevel,
            budgetMin: input.budgetMin,
            budgetMax: input.budgetMax,
            maxDistanceMeters: input.maxDistanceMeters,
            onboardingCompleted,
          },
          create: {
            userId,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            areaLabel: input.areaLabel?.trim() || null,
            mealPeriod: input.mealPeriod ?? null,
            spicyLevel: input.spicyLevel,
            sweetLevel: input.sweetLevel,
            sourLevel: input.sourLevel,
            saltyLevel: input.saltyLevel,
            budgetMin: input.budgetMin,
            budgetMax: input.budgetMax,
            maxDistanceMeters: input.maxDistanceMeters,
            onboardingCompleted,
          },
        });

        await transaction.userAllergy.deleteMany({ where: { userId } });
        await transaction.userDietaryRestriction.deleteMany({ where: { userId } });
        await transaction.userCuisinePreference.deleteMany({ where: { userId } });

        if (input.allergies.length > 0) {
          await transaction.userAllergy.createMany({
            data: input.allergies.map((item, index) => ({
              userId,
              allergenId: resolved.allergenIds[index]!,
              severity: item.severity,
              notes: item.notes?.trim() || null,
            })),
          });
        }

        if (input.dietaryRestrictions.length > 0) {
          await transaction.userDietaryRestriction.createMany({
            data: input.dietaryRestrictions.map((item, index) => ({
              userId,
              dietaryRestrictionId: resolved.dietaryRestrictionIds[index]!,
              isMandatory: item.isMandatory,
            })),
          });
        }

        if (input.cuisinePreferences.length > 0) {
          await transaction.userCuisinePreference.createMany({
            data: input.cuisinePreferences.map((item, index) => ({
              userId,
              cuisineId: resolved.cuisineIds[index]!,
              preferenceScore: item.preferenceScore,
            })),
          });
        }

        const stored = await findStoredProfile(transaction, userId);
        if (!stored) {
          throw new Error("Taste profile was not created");
        }

        return stored;
      });
    },
  };
}

export type TasteProfileRepository = ReturnType<typeof createTasteProfileRepository>;
