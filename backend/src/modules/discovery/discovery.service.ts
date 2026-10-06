import { createHash } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { normalizeFoodText } from "../food/food.schema.js";
import { foodIdentity } from "../food/food.identity.js";
import { hasUnprocessedFoodKnowledge } from "../personal-food-knowledge/personal-food-knowledge.policy.js";
import { REPEAT_WINDOW_MS } from "../food/food.policy.js";
import {
  createRecipeProviders,
  recipeSources,
  type RecipeSource,
  type Recipe,
} from "./recipe.providers.js";
import {
  createPlaceProviders,
  placeSources,
  type PlaceSource,
  type Location,
} from "./place.providers.js";
import { ProviderError } from "./provider.http.js";
import { quotaFetch } from "./provider.quota.js";
export type SourceStatus = {
  source: string;
  status: "OK" | "NOT_CONFIGURED" | "UNAVAILABLE" | "QUOTA_EXCEEDED" | "INVALID_DATA";
};
export async function collectSources<T>(
  sources: readonly string[],
  configured: (s: string) => boolean,
  run: (s: string) => Promise<T[]>,
) {
  const results = await Promise.all(
    sources.map(async (source) => {
      if (!configured(source))
        return { items: [] as T[], source, status: "NOT_CONFIGURED" as const };
      try {
        return { items: await run(source), source, status: "OK" as const };
      } catch (error) {
        return {
          items: [] as T[],
          source,
          status:
            error instanceof ProviderError
              ? error.status
              : error instanceof AppError && error.code === "PLACES_QUOTA_EXCEEDED"
                ? ("QUOTA_EXCEEDED" as const)
                : ("UNAVAILABLE" as const),
        };
      }
    }),
  );
  const statuses: SourceStatus[] = results.map(({ source, status }) => ({ source, status }));
  return {
    items: results.flatMap((r) => r.items),
    sources: statuses,
    status: statuses.every((s) => s.status === "NOT_CONFIGURED")
      ? "NOT_CONFIGURED"
      : statuses.some((s) => s.status === "OK")
        ? "SUCCESS"
        : "UNAVAILABLE",
  };
}
export function dedupeRecipes(items: Recipe[]) {
  const seen = new Set<string>();
  return items.filter((r) => {
    const name = foodIdentity(r.title);
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}
export function createDiscoveryService(
  prisma: PrismaClient,
  env = process.env,
  fetcher: typeof fetch = fetch,
) {
  const boundedFetch = quotaFetch(prisma, env, fetcher);
  const recipes = createRecipeProviders(env, boundedFetch);
  const places = createPlaceProviders(env, boundedFetch);
  const canonicalNames = async (titles: string[]) => {
    const names = titles.map(normalizeFoodText);
    const dishes = titles.length
      ? await prisma.dish.findMany({
          where: {
            OR: [
              { name: { in: titles, mode: "insensitive" } },
              { aliases: { some: { normalizedAlias: { in: names } } } },
            ],
          },
          select: { id: true, name: true, aliases: { select: { normalizedAlias: true } } },
        })
      : [];
    const aliases = new Map<string, Map<string, { id: string; name: string }>>();
    for (const d of dishes) {
      for (const name of [normalizeFoodText(d.name), ...d.aliases.map((a) => a.normalizedAlias)]) {
        const matches = aliases.get(name) ?? new Map();
        matches.set(d.id, d);
        aliases.set(name, matches);
      }
    }
    const resolve = (title: string) => {
      const matches = aliases.get(normalizeFoodText(title));
      return matches?.size === 1 ? [...matches.values()][0]! : null;
    };
    return Object.assign(
      (title: string) => {
        const dish = resolve(title);
        return dish ? foodIdentity(dish.name) : foodIdentity(title);
      },
      {
        resolve,
        ambiguous: (title: string) => (aliases.get(normalizeFoodText(title))?.size ?? 0) > 1,
      },
    );
  };
  const searchRecipes = async (query: string, source?: RecipeSource, day?: number) => {
    const result = await collectSources(
      source ? [source] : recipeSources,
      (s) => recipes.configured(s as RecipeSource),
      (s) => recipes.search(s as RecipeSource, query, day),
    );
    return {
      ...result,
      items: dedupeRecipes(result.items),
      notice:
        "Công thức từ nguồn bên ngoài, không phải thực đơn quán. Giá và độ phù hợp khẩu vị chưa được xác minh.",
    };
  };
  const detail = async (source: RecipeSource, id: string) => {
    if (!recipes.configured(source))
      throw new AppError(503, "RECIPE_NOT_CONFIGURED", "Nguồn công thức chưa được cấu hình");
    let recipe;
    try {
      recipe = await recipes.detail(source, id);
    } catch {
      throw new AppError(
        503,
        "RECIPE_UNAVAILABLE",
        "Chưa lấy được hướng dẫn nấu, vui lòng thử lại",
      );
    }
    if (!recipe || recipe.id !== id)
      throw new AppError(404, "RECIPE_NOT_FOUND", "Không tìm thấy công thức");
    return recipe;
  };
  return {
    sources() {
      return [
        ...recipeSources.map((source) => ({
          source,
          type: "RECIPE",
          configured: recipes.configured(source),
        })),
        ...placeSources.map((source) => ({
          source,
          type: "PLACE",
          configured: places.configured(source),
        })),
      ];
    },
    searchRecipes,
    detail,
    async restaurants(
      userId: string,
      query: string,
      source?: PlaceSource,
      location?: Location,
      radius?: number,
      openNow?: boolean,
    ) {
      const profile = await prisma.tasteProfile.findUnique({ where: { userId } });
      const origin =
        location ??
        (profile?.latitude != null && profile.longitude != null
          ? { latitude: profile.latitude, longitude: profile.longitude }
          : null);
      if (!origin)
        throw new AppError(
          400,
          "LOCATION_REQUIRED",
          "Cho phép lấy vị trí hoặc lưu vị trí trong hồ sơ để tìm quán",
        );
      const result = await collectSources(
        source ? [source] : placeSources,
        (s) => places.configured(s as PlaceSource),
        (s) =>
          places.search(
            s as PlaceSource,
            query,
            origin,
            radius ?? profile?.maxDistanceMeters ?? 3500,
          ),
      );
      const seen = new Set<string>();
      return {
        ...result,
        items: result.items
          .filter((p) => {
            const key = `${p.source}:${p.placeId}`;
            if (seen.has(key) || (openNow && p.openNow !== true)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => a.distanceMeters - b.distanceMeters),
        updatedAt: new Date().toISOString(),
        notice:
          "Kết quả chưa xác nhận thực đơn hay giá món. Geoapify chỉ tìm nhà hàng gần vị trí; Goong trả địa điểm liên quan từ khóa.",
      };
    },
    async today(userId: string, now = new Date()) {
      if (await hasUnprocessedFoodKnowledge(prisma, userId))
        return { status: "PROFILE_PENDING_ANALYSIS", items: [], sources: [] };
      const profile = await prisma.tasteProfile.findUnique({ where: { userId } });
      if (!profile?.onboardingCompleted)
        return { status: "ONBOARDING_REQUIRED", items: [], sources: [] };
      const [allergies, mandatory] = await Promise.all([
        prisma.userAllergy.count({ where: { userId } }),
        prisma.userDietaryRestriction.count({ where: { userId, isMandatory: true } }),
      ]);
      // Never turn missing recipe metadata into proof of safety or price compliance.
      if (allergies || mandatory)
        return { status: "INSUFFICIENT_SAFETY_DATA", items: [], sources: [] };
      const day = Math.floor((now.getTime() + 7 * 3600000) / 86400000);
      const [result, recent, localRecent, dislikes] = await Promise.all([
        searchRecipes("", undefined, day),
        prisma.recipeInteraction.findMany({
          where: {
            userId,
            interactionType: { in: ["CHOSEN", "EATEN"] },
            createdAt: { gt: new Date(now.getTime() - REPEAT_WINDOW_MS) },
          },
          select: { canonicalName: true, canonicalDishId: true, source: true, recipeId: true },
        }),
        prisma.userInteraction.findMany({
          where: {
            userId,
            interactionType: { in: ["CHOSEN", "EATEN"] },
            createdAt: { gt: new Date(now.getTime() - REPEAT_WINDOW_MS) },
          },
          include: { dish: { include: { aliases: true } } },
        }),
        prisma.userDishPreference.findMany({
          where: { userId, preference: "DISLIKED" },
          include: { dish: { include: { aliases: true } } },
        }),
      ]);
      const blocked = new Set(recent.map((r) => r.canonicalName));
      const blockedDishIds = new Set(
        recent.map((row) => row.canonicalDishId).filter((id) => id !== null),
      );
      const blockedRecipeIds = new Set(recent.map((row) => `${row.source}:${row.recipeId}`));
      for (const r of [...localRecent, ...dislikes]) {
        blocked.add(foodIdentity(r.dish.name));
        r.dish.aliases.forEach((a) => blocked.add(foodIdentity(a.normalizedAlias)));
      }
      const rank = (r: Recipe) =>
        createHash("sha256")
          .update(`${userId}:${day}:${normalizeFoodText(r.title)}`)
          .digest("hex");
      const canonical = await canonicalNames(result.items.map((r) => r.title));
      const items = result.items
        .filter(
          (r) =>
            !blockedRecipeIds.has(`${r.source}:${r.id}`) &&
            !blockedDishIds.has(canonical.resolve(r.title)?.id ?? "") &&
            !blocked.has(canonical(r.title)),
        )
        .sort((a, b) => rank(a).localeCompare(rank(b)))
        .slice(0, 12);
      return {
        ...result,
        items,
        repeatAfterHours: 96,
        excludedRecentCount: recent.length,
        generatedAt: now.toISOString(),
        recommendationKind: "COOKING_IDEAS",
        budgetVerified: false,
        notice:
          "Ý tưởng nấu tại nhà từ API, đã loại món ăn trong 4 ngày. Chưa có dữ liệu xác minh chi phí, độ cay/mặn hoặc giá bán tại quán.",
      };
    },
    async record(
      userId: string,
      source: RecipeSource,
      id: string,
      type: "CHOSEN" | "EATEN",
      key: string,
      eatenAt?: string,
    ) {
      const createdAt = eatenAt ? new Date(eatenAt) : new Date();
      if (
        (type === "CHOSEN" && eatenAt) ||
        createdAt.getTime() > Date.now() ||
        createdAt.getTime() < Date.now() - 30 * 86400000 ||
        !Number.isFinite(createdAt.getTime())
      )
        throw new AppError(400, "INVALID_EATEN_AT", "Thời điểm ăn phải nằm trong 30 ngày vừa qua");
      const idempotencyKey = `${userId}:recipe:${key}`;
      const existing = await prisma.recipeInteraction.findUnique({ where: { idempotencyKey } });
      const recipe = existing ? null : await detail(source, id);
      const canonical = recipe ? await canonicalNames([recipe.title]) : null;
      const action =
        existing ??
        (await prisma.recipeInteraction.upsert({
          where: { idempotencyKey },
          update: {},
          create: {
            userId,
            source,
            recipeId: id,
            title: recipe!.title,
            canonicalName: canonical!.ambiguous(recipe!.title)
              ? `recipe:${source}:${id}`
              : canonical!(recipe!.title),
            canonicalDishId: canonical!.resolve(recipe!.title)?.id ?? null,
            interactionType: type,
            idempotencyKey,
            createdAt,
          },
        }));
      if (
        action.source !== source ||
        action.recipeId !== id ||
        action.interactionType !== type ||
        (eatenAt && action.createdAt.getTime() !== createdAt.getTime())
      )
        throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Mã thao tác đã dùng cho lựa chọn khác");
      return {
        ...action,
        idempotencyKey: undefined,
        userId: undefined,
        eligibleAgainAt: new Date(action.createdAt.getTime() + REPEAT_WINDOW_MS),
        canonicalName: action.canonicalName,
      };
    },
  };
}
