import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  createTasteProfileService,
  type ProfileResponse,
} from "../taste-profile/taste-profile.service.js";
import { createTasteProfileRepository } from "../taste-profile/taste-profile.repository.js";
import { dishInclude } from "./food.repository.js";
import { REPEAT_WINDOW_MS } from "./food.policy.js";
import { foodIdentity } from "./food.identity.js";
import { AppError } from "../../common/errors/app-error.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { hasUnprocessedFoodKnowledge } from "../personal-food-knowledge/personal-food-knowledge.policy.js";
import {
  behavioralAdjustment,
  buildBehavioralSnapshot,
  type BehavioralDish,
} from "./behavioral-personalization.policy.js";
type Candidate = {
  id: string;
  priceMin: number;
  priceMax: number;
  verificationStatus: string;
  evidenceSource: string | null;
  dietaryCodes: string[];
  mealPeriods: string[];
  spicyLevel: number;
  sweetLevel: number;
  sourLevel: number;
  saltyLevel: number;
  cuisine: { code: string };
};
export function candidateAllowed(
  d: Candidate,
  p: ProfileResponse,
  disliked: Set<string>,
  recent: Set<string>,
) {
  if (
    disliked.has(d.id) ||
    recent.has(d.id) ||
    d.priceMin < p.budgetMin ||
    d.priceMax > p.budgetMax
  )
    return false;
  if (p.mealPeriod && d.mealPeriods.length && !d.mealPeriods.includes(p.mealPeriod)) return false;
  // Missing allergen rows do not prove absence; recipes cannot certify restaurant preparation.
  if (p.allergies.length) return false;
  return p.dietaryRestrictions
    .filter((r) => r.isMandatory)
    .every(
      (r) =>
        d.verificationStatus === "VERIFIED" &&
        !!d.evidenceSource &&
        d.dietaryCodes.includes(r.code),
    );
}
export function candidateScore(
  d: Candidate,
  p: ProfileResponse,
  liked: Set<string>,
  learnedAdjustment = 0,
) {
  const keys = ["spicyLevel", "sweetLevel", "sourLevel", "saltyLevel"] as const;
  return (
    100 -
    keys.reduce((sum, k) => sum + Math.abs(d[k] - p[k]), 0) / 4 +
    (liked.has(d.id) ? 30 : 0) +
    (p.cuisinePreferences.find((c) => c.code === d.cuisine.code)?.preferenceScore ?? 0) / 5 +
    Math.max(-24, Math.min(24, learnedAdjustment))
  );
}

const behavioralDish = (dish: {
  id: string;
  priceMin: number;
  priceMax: number;
  spicyLevel: number;
  sweetLevel: number;
  sourLevel: number;
  saltyLevel: number;
  cuisine: { code: string };
}): BehavioralDish => ({
  id: dish.id,
  cuisineCode: dish.cuisine.code,
  priceMin: dish.priceMin,
  priceMax: dish.priceMax,
  spicyLevel: dish.spicyLevel,
  sweetLevel: dish.sweetLevel,
  sourLevel: dish.sourLevel,
  saltyLevel: dish.saltyLevel,
});

const learnedReason = (reasonCode: string | null) => {
  if (!reasonCode) return null;
  if (reasonCode.endsWith("DIRECT")) return "Dựa trên phản hồi trước đây của bạn về chính món này";
  if (reasonCode.endsWith("CUISINE")) return "Bạn thường phản hồi tích cực với các món cùng nền ẩm thực";
  if (reasonCode.endsWith("FLAVOR")) return "Hương vị gần với những món bạn thường thích";
  if (reasonCode.endsWith("PRICE")) return "Tầm giá gần với những lựa chọn bạn thường quan tâm";
  return null;
};
export function createFoodService(prisma: PrismaClient) {
  const profiles = createTasteProfileService(createTasteProfileRepository(prisma));
  return {
    async today(userId: string, now = new Date(), mealPeriod?: ProfileResponse["mealPeriod"]) {
      if (await hasUnprocessedFoodKnowledge(prisma, userId))
        return { status: "PROFILE_PENDING_ANALYSIS", items: [], repeatAfterHours: 96 };
      const storedProfile = await profiles.getProfile(userId);
      const profile = storedProfile
        ? { ...storedProfile, mealPeriod: mealPeriod ?? storedProfile.mealPeriod ?? null }
        : storedProfile;
      if (!profile?.onboardingCompleted)
        return { status: "ONBOARDING_REQUIRED", items: [], repeatAfterHours: 96 };
      const learningSince = new Date(now.getTime() - 180 * 86400000);
      const [dishes, preferences, history, recipeHistory, behavioralEvents] = await Promise.all([
        prisma.dish.findMany({
          include: dishInclude,
          where: {
            isActive: true,
            cuisine: { isActive: true },
            priceMin: { gte: profile.budgetMin },
            priceMax: { lte: profile.budgetMax },
          },
          orderBy: { id: "asc" },
          take: 501,
        }),
        prisma.userDishPreference.findMany({
          where: { userId },
          include: { dish: { include: { cuisine: true } } },
        }),
        prisma.userInteraction.findMany({
          where: {
            userId,
            interactionType: { in: ["CHOSEN", "EATEN"] },
            createdAt: { gt: new Date(now.getTime() - REPEAT_WINDOW_MS) },
          },
          select: { dishId: true },
        }),
        prisma.recipeInteraction.findMany({
          where: {
            userId,
            interactionType: { in: ["CHOSEN", "EATEN"] },
            createdAt: { gt: new Date(now.getTime() - REPEAT_WINDOW_MS) },
          },
          select: { canonicalName: true, canonicalDishId: true },
        }),
        prisma.userInteraction.findMany({
          where: { userId, createdAt: { gte: learningSince } },
          select: {
            id: true,
            dishId: true,
            interactionType: true,
            rating: true,
            createdAt: true,
            dish: { include: { cuisine: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 500,
        }),
      ]);
      const liked = new Set(
        preferences.filter((p) => p.preference === "LIKED").map((p) => p.dishId),
      );
      const disliked = new Set(
        preferences.filter((p) => p.preference === "DISLIKED").map((p) => p.dishId),
      );
      const recent = new Set(history.map((p) => p.dishId));
      const recentNames = new Set(recipeHistory.map((p) => p.canonicalName));
      recipeHistory.forEach((row) => {
        if (row.canonicalDishId) recent.add(row.canonicalDishId);
      });
      for (const d of dishes) {
        if (
          recentNames.has(foodIdentity(d.name)) ||
          d.aliases.some((a) => recentNames.has(foodIdentity(a.normalizedAlias)))
        )
          recent.add(d.id);
      }
      const featureDishes = new Map<string, BehavioralDish>();
      for (const dish of dishes) featureDishes.set(dish.id, behavioralDish(dish));
      for (const event of behavioralEvents)
        featureDishes.set(event.dish.id, behavioralDish(event.dish));
      for (const preference of preferences)
        featureDishes.set(preference.dish.id, behavioralDish(preference.dish));
      const learning = buildBehavioralSnapshot(
        [...featureDishes.values()],
        behavioralEvents.map((event) => ({
          id: event.id,
          dishId: event.dishId,
          type: event.interactionType,
          rating: event.rating,
          at: event.createdAt,
        })),
        preferences.map((preference) => ({
          dishId: preference.dishId,
          preference: preference.preference,
          updatedAt: preference.updatedAt,
        })),
        now,
      );
      const cuisineNames = new Map<string, string>();
      for (const dish of behavioralEvents.map((event) => event.dish).concat(preferences.map((item) => item.dish), dishes))
        cuisineNames.set(dish.cuisine.code, dish.cuisine.name);
      const items = dishes
        .slice(0, 500)
        .filter((d) => candidateAllowed(d, profile, disliked, recent))
        .map((d) => {
          const learned = behavioralAdjustment(behavioralDish(d), learning);
          const behaviorReason =
            learned.adjustment > 0 && learned.materiallyInfluenced
              ? learnedReason(learned.reasonCode)
              : null;
          return {
            ...d,
            score: candidateScore(d, profile, liked, learned.adjustment),
            behaviorAdjustment: learned.adjustment,
            learnedReason: behaviorReason,
            reason: behaviorReason
              ? `${behaviorReason}. Món vẫn đáp ứng khẩu vị và khoảng giá hiện tại.`
              : liked.has(d.id)
                ? "Món bạn thích, phù hợp khẩu vị và khoảng giá tham khảo"
                : "Phù hợp khẩu vị và khoảng giá tham khảo",
            priceSource: "KNOWLEDGE_BASE_ESTIMATE",
            safetyWarning:
              "Công thức và giá có thể khác tại từng quán. Cần xác nhận thành phần và giá với quán.",
          };
        })
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .slice(0, 20);
      return {
        status: items.length
          ? "SUCCESS"
          : profile.allergies.length
            ? "INSUFFICIENT_SAFETY_DATA"
            : "NO_MATCH",
        items,
        repeatAfterHours: 96,
        excludedRecentCount: recent.size,
        candidateLimitReached: dishes.length > 500,
        generatedAt: now.toISOString(),
        learning: {
          sampleSize: learning.sampleSize,
          confidence: learning.confidence,
          topCuisines: learning.positiveCuisineCodes.map((code) => ({
            code,
            name: cuisineNames.get(code) ?? code,
          })),
          privateToUser: true,
        },
      };
    },
    async record(
      userId: string,
      dishId: string,
      type: "VIEWED" | "LIKED" | "SKIPPED" | "CHOSEN" | "EATEN" | "RATED",
      key: string,
      eatenAt?: string,
      rating?: number,
    ) {
      const createdAt = eatenAt ? new Date(eatenAt) : new Date();
      if ((type === "RATED") !== (rating !== undefined && rating >= 1 && rating <= 5))
        throw new AppError(400, "INVALID_RATING", "Chỉ đánh giá mới được gửi số sao từ 1 đến 5");
      if (eatenAt && type !== "EATEN")
        throw new AppError(400, "INVALID_EATEN_AT", "Chỉ món đã ăn mới có thời điểm ăn");
      if (
        !Number.isFinite(createdAt.getTime()) ||
        createdAt.getTime() > Date.now() ||
        createdAt.getTime() < Date.now() - 30 * 86400000
      )
        throw new AppError(400, "INVALID_EATEN_AT", "Chỉ ghi nhận trong 30 ngày vừa qua");
      return serializableWrite(prisma, async (tx) => {
        const dish = await tx.dish.findUnique({
          where: { id: dishId },
          include: { cuisine: true },
        });
        if (!dish) throw new AppError(404, "DISH_NOT_FOUND", "Không tìm thấy món");
        const idempotencyKey = `${userId}:${key}`;
        if (
          type === "CHOSEN" &&
          (!dish.isActive || !dish.cuisine.isActive) &&
          !(await tx.userInteraction.findUnique({ where: { idempotencyKey } }))
        )
          throw new AppError(
            409,
            "DISH_UNAVAILABLE",
            "Món tạm ngừng gợi ý. Hãy chọn món khác hoặc tải lại danh sách.",
          );
        const action = await tx.userInteraction.upsert({
          where: { idempotencyKey },
          update: {},
          create: {
            userId,
            dishId,
            interactionType: type,
            rating: rating ?? null,
            idempotencyKey,
            createdAt,
          },
        });
        if (
          action.userId !== userId ||
          action.dishId !== dishId ||
          action.interactionType !== type ||
          action.rating !== (rating ?? null) ||
          (eatenAt && action.createdAt.getTime() !== createdAt.getTime())
        )
          throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Mã thao tác đã dùng cho lựa chọn khác");
        return {
          id: action.id,
          dishId,
          interactionType: type,
          createdAt: action.createdAt,
          eligibleAgainAt: new Date(action.createdAt.getTime() + REPEAT_WINDOW_MS),
        };
      });
    },
  };
}
