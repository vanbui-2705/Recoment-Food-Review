import { AppError } from "../../common/errors/app-error.js";
import type { ProfilePayload } from "./taste-profile.schema.js";
import type {
  CatalogRecord,
  StoredProfile,
  TasteProfileRepository,
} from "./taste-profile.repository.js";

export type CatalogKind = "allergens" | "dietary-restrictions" | "cuisines";

export type ProfileResponse = {
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
  allergies: StoredProfile["allergies"];
  dietaryRestrictions: StoredProfile["dietaryRestrictions"];
  cuisinePreferences: StoredProfile["cuisinePreferences"];
};

/** Chuẩn hóa catalog code trước khi tra cứu và lưu dữ liệu. */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Phát hiện lựa chọn trùng trong từng nhóm constraint của hồ sơ. */
function assertUniqueCodes(field: string, selections: Array<{ code: string }>): string[] {
  const normalized = selections.map((selection) => normalizeCode(selection.code));
  const seen = new Set<string>();
  const duplicate = normalized.find((code) => {
    if (seen.has(code)) {
      return true;
    }
    seen.add(code);
    return false;
  });

  if (duplicate) {
    throw new AppError(400, "DUPLICATE_SELECTION", "Một mã lựa chọn bị lặp trong hồ sơ", [
      { field, code: duplicate },
    ]);
  }

  return normalized;
}

/** Kiểm tra các luật nghiệp vụ không thể mô tả đầy đủ bằng TypeBox. */
function validateBusinessRules(input: ProfilePayload): void {
  if ((input.latitude == null) !== (input.longitude == null)) {
    throw new AppError(400, "INVALID_LOCATION", "Cần cung cấp cả vĩ độ và kinh độ");
  }
  if (input.budgetMin > input.budgetMax) {
    throw new AppError(
      400,
      "INVALID_BUDGET_RANGE",
      "Ngân sách tối thiểu không được lớn hơn ngân sách tối đa",
      [{ field: "budgetMin", message: "budgetMin must be less than or equal to budgetMax" }],
    );
  }

  assertUniqueCodes("allergies", input.allergies);
  assertUniqueCodes("dietaryRestrictions", input.dietaryRestrictions);
  assertUniqueCodes("cuisinePreferences", input.cuisinePreferences);
}

/** Đổi danh sách code public thành ID catalog nội bộ của Prisma. */
function resolveCodes(field: string, codes: string[], catalog: CatalogRecord[]): string[] {
  const byCode = new Map(catalog.map((item) => [normalizeCode(item.code), item]));
  const missing = codes.find((code) => !byCode.has(code));

  if (missing) {
    throw new AppError(400, "UNKNOWN_CATALOG_CODE", "Mã lựa chọn không tồn tại trong catalog", [
      { field, code: missing },
    ]);
  }

  return codes.map((code) => byCode.get(code)!.id);
}

/** Chuyển dữ liệu lưu trữ thành DTO public, không làm lộ metadata Prisma. */
function toResponse(stored: StoredProfile | null): ProfileResponse | null {
  if (!stored) {
    return null;
  }

  return {
    latitude: stored.profile.latitude ?? null,
    longitude: stored.profile.longitude ?? null,
    areaLabel: stored.profile.areaLabel ?? null,
    mealPeriod: stored.profile.mealPeriod ?? null,
    spicyLevel: stored.profile.spicyLevel,
    sweetLevel: stored.profile.sweetLevel,
    sourLevel: stored.profile.sourLevel,
    saltyLevel: stored.profile.saltyLevel,
    budgetMin: stored.profile.budgetMin,
    budgetMax: stored.profile.budgetMax,
    maxDistanceMeters: stored.profile.maxDistanceMeters,
    onboardingCompleted: stored.profile.onboardingCompleted,
    allergies: stored.allergies,
    dietaryRestrictions: stored.dietaryRestrictions,
    cuisinePreferences: stored.cuisinePreferences,
  };
}

/** Chuẩn hóa shape và thứ tự item trong response catalog. */
function catalogResponse(items: CatalogRecord[]) {
  return items
    .map(({ code, name, description }) => ({ code, name, description }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

/** Tạo service điều phối validate, resolve catalog và ghi hồ sơ atomic. */
export function createTasteProfileService(repository: TasteProfileRepository) {
  return {
    /** Đọc một catalog theo loại được route yêu cầu. */
    async listCatalog(kind: CatalogKind) {
      const items =
        kind === "allergens"
          ? await repository.listAllergens()
          : kind === "dietary-restrictions"
            ? await repository.listDietaryRestrictions()
            : await repository.listCuisines();

      return catalogResponse(items);
    },

    /** Lấy hồ sơ hiện tại hoặc null nếu user chưa onboarding. */
    async getProfile(userId: string): Promise<ProfileResponse | null> {
      return toResponse(await repository.findProfile(userId));
    },

    /** Validate và thay thế toàn bộ hồ sơ của user hiện tại. */
    async saveProfile(
      userId: string,
      input: ProfilePayload,
      markOnboardingCompleted: boolean,
    ): Promise<ProfileResponse> {
      validateBusinessRules(input);

      const [allergens, dietaryRestrictions, cuisines] = await Promise.all([
        repository.listAllergens(),
        repository.listDietaryRestrictions(),
        repository.listCuisines(),
      ]);
      const allergyCodes = assertUniqueCodes("allergies", input.allergies);
      const dietaryCodes = assertUniqueCodes("dietaryRestrictions", input.dietaryRestrictions);
      const cuisineCodes = assertUniqueCodes("cuisinePreferences", input.cuisinePreferences);
      const resolved = {
        allergenIds: resolveCodes("allergies", allergyCodes, allergens),
        dietaryRestrictionIds: resolveCodes(
          "dietaryRestrictions",
          dietaryCodes,
          dietaryRestrictions,
        ),
        cuisineIds: resolveCodes("cuisinePreferences", cuisineCodes, cuisines),
      };

      const normalizedInput: ProfilePayload = {
        ...input,
        allergies: input.allergies.map((item, index) => ({
          ...item,
          code: allergyCodes[index]!,
        })),
        dietaryRestrictions: input.dietaryRestrictions.map((item, index) => ({
          ...item,
          code: dietaryCodes[index]!,
        })),
        cuisinePreferences: input.cuisinePreferences.map((item, index) => ({
          ...item,
          code: cuisineCodes[index]!,
        })),
      };
      const saved = await repository.replaceProfile(
        userId,
        normalizedInput,
        resolved,
        markOnboardingCompleted,
      );
      const response = toResponse(saved);

      if (!response) {
        throw new Error("Saved taste profile is missing");
      }

      return response;
    },
  };
}
