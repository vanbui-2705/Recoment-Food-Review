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
export function candidateScore(d: Candidate, p: ProfileResponse, liked: Set<string>) {
  const keys = ["spicyLevel", "sweetLevel", "sourLevel", "saltyLevel"] as const;
  return (
    100 -
    keys.reduce((sum, k) => sum + Math.abs(d[k] - p[k]), 0) / 4 +
    (liked.has(d.id) ? 30 : 0) +
    (p.cuisinePreferences.find((c) => c.code === d.cuisine.code)?.preferenceScore ?? 0) / 5
  );
}
export function createFoodService(prisma: PrismaClient) {
  const profiles = createTasteProfileService(createTasteProfileRepository(prisma));
  return {
    async today(userId: string, now = new Date()) {
      const profile = await profiles.getProfile(userId);
      if (!profile?.onboardingCompleted)
        return { status: "ONBOARDING_REQUIRED", items: [], repeatAfterHours: 96 };
      const [dishes, preferences, history, recipeHistory] = await Promise.all([
        prisma.dish.findMany({
          include: dishInclude,
          where: { priceMin: { gte: profile.budgetMin }, priceMax: { lte: profile.budgetMax } },
          orderBy: { id: "asc" },
          take: 501,
        }),
        prisma.userDishPreference.findMany({ where: { userId } }),
        prisma.userInteraction.findMany({
          where: {
            userId,
            interactionType: { in: ["CHOSEN", "EATEN"] },
            createdAt: { gt: new Date(now.getTime() - REPEAT_WINDOW_MS) },
          },
          select: { dishId: true },
        }),
        prisma.recipeInteraction.findMany({
          where: { userId, createdAt: { gt: new Date(now.getTime() - REPEAT_WINDOW_MS) } },
          select: { canonicalName: true },
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
      for (const d of dishes) {
        if (
          recentNames.has(foodIdentity(d.name)) ||
          d.aliases.some((a) => recentNames.has(foodIdentity(a.normalizedAlias)))
        )
          recent.add(d.id);
      }
      const items = dishes
        .slice(0, 500)
        .filter((d) => candidateAllowed(d, profile, disliked, recent))
        .map((d) => ({
          ...d,
          score: candidateScore(d, profile, liked),
          reason: liked.has(d.id)
            ? "Món bạn thích, phù hợp khẩu vị và khoảng giá tham khảo"
            : "Phù hợp khẩu vị và khoảng giá tham khảo",
          priceSource: "KNOWLEDGE_BASE_ESTIMATE",
          safetyWarning:
            "Công thức và giá có thể khác tại từng quán. Cần xác nhận thành phần và giá với quán.",
        }))
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
      };
    },
    async record(
      userId: string,
      dishId: string,
      type: "CHOSEN" | "EATEN",
      key: string,
      eatenAt?: string,
    ) {
      const createdAt = eatenAt ? new Date(eatenAt) : new Date();
      if (
        !Number.isFinite(createdAt.getTime()) ||
        createdAt.getTime() > Date.now() ||
        createdAt.getTime() < Date.now() - 30 * 86400000
      )
        throw new AppError(400, "INVALID_EATEN_AT", "Chỉ ghi nhận trong 30 ngày vừa qua");
      return prisma.$transaction(async (tx) => {
        if (!(await tx.dish.findUnique({ where: { id: dishId } })))
          throw new AppError(404, "DISH_NOT_FOUND", "Không tìm thấy món");
        const idempotencyKey = `${userId}:${key}`;
        const action = await tx.userInteraction.upsert({
          where: { idempotencyKey },
          update: {},
          create: { userId, dishId, interactionType: type, idempotencyKey, createdAt },
        });
        if (
          action.userId !== userId ||
          action.dishId !== dishId ||
          action.interactionType !== type ||
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
