import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { createTasteProfileService } from "../taste-profile/taste-profile.service.js";
import { createTasteProfileRepository } from "../taste-profile/taste-profile.repository.js";
import { createDiscoveryService } from "../discovery/discovery.service.js";
import { distanceMeters, REPEAT_WINDOW_MS } from "../food/food.policy.js";
import { foodIdentity } from "../food/food.identity.js";
import { safetyDecision } from "../merchant-menu/safety.policy.js";
import { feedbackScores, applyFeedback } from "./feedback.policy.js";
import {
  diversify,
  loadRankingWeights,
  normalizedScore,
  groundedReasons,
} from "./recommendation.policy.js";

export type RecommendationContext = {
  budget: number;
  radius: number;
  latitude: number;
  longitude: number;
  onlyOpen?: boolean;
};
export function createCandidateService(
  prisma: PrismaClient,
  env = process.env,
  fetcher: typeof fetch = fetch,
) {
  const discovery = createDiscoveryService(prisma, env, fetcher);
  const profiles = createTasteProfileService(createTasteProfileRepository(prisma));
  const weights = loadRankingWeights(env);
  return {
    async context(
      userId: string,
      input: Partial<RecommendationContext>,
    ): Promise<RecommendationContext> {
      const [profile, settings] = await Promise.all([
        prisma.tasteProfile.findUnique({ where: { userId } }),
        prisma.discoverySettings.findUnique({ where: { userId } }),
      ]);
      const latitude = input.latitude ?? settings?.latitude ?? profile?.latitude,
        longitude = input.longitude ?? settings?.longitude ?? profile?.longitude;
      if (latitude == null || longitude == null)
        throw new AppError(400, "LOCATION_REQUIRED", "Cần vị trí để tìm món quanh bạn");
      return {
        latitude,
        longitude,
        budget: input.budget ?? settings?.budget ?? profile?.budgetMax ?? 50000,
        radius:
          input.radius ??
          settings?.radius ??
          Math.min(4000, Math.max(3000, profile?.maxDistanceMeters ?? 3500)),
        onlyOpen: input.onlyOpen ?? settings?.onlyOpen ?? false,
      };
    },
    async pool(
      userId: string,
      context: RecommendationContext,
      personalized = true,
      now = new Date(),
      providedPlaces?: Awaited<ReturnType<typeof discovery.restaurants>>,
    ) {
      const [profile, note, storedProfile] = await Promise.all([
        profiles.getProfile(userId),
        prisma.personalFoodKnowledge.findUnique({ where: { userId } }),
        prisma.tasteProfile.findUnique({ where: { userId } }),
      ]);
      const pending = !!note && note.analyzedRevision < note.revision;
      const profileToken = {
        revision: note?.revision ?? 0,
        analyzedRevision: note?.analyzedRevision ?? 0,
        updatedAt: storedProfile?.updatedAt.toISOString() ?? null,
      };
      const empty = (status: string) => ({
        status,
        items: [],
        restaurants: [],
        sources: [],
        candidateLimitReached: false,
        profileToken,
      });
      if (personalized && pending) return empty("PROFILE_PENDING_ANALYSIS");
      if (personalized && !profile?.onboardingCompleted) return empty("ONBOARDING_REQUIRED");
      const since = new Date(+now - REPEAT_WINDOW_MS);
      const latitudeDelta = context.radius / 110000 + 0.001;
      const [offers, preferences, recent, recipes, places] = await Promise.all([
        prisma.externalMenuItem.findMany({
          where: {
            active: true,
            moderationEnabled: true,
            dish: { isActive: true, cuisine: { isActive: true } },
            isAvailable: true,
            mappingStatus: "APPROVED",
            dishId: { not: null },
            currency: "VND",
            price: { lte: context.budget },
            expiresAt: { gt: now },
            observedAt: { lte: now },
            identity: {
              supplier: { enabled: true },
              restaurant: {
                isActive: true,
                latitude: {
                  gte: Math.max(-90, context.latitude - latitudeDelta),
                  lte: Math.min(90, context.latitude + latitudeDelta),
                },
                businessStatus: { notIn: ["PERMANENTLY_CLOSED", "TEMPORARILY_CLOSED"] },
              },
            },
          },
          include: {
            identity: { include: { restaurant: true, supplier: true } },
            dish: { include: { aliases: true, cuisine: true } },
            evidence: true,
          },
          orderBy: [{ price: "asc" }, { id: "asc" }],
          take: 501,
        }),
        prisma.userDishPreference.findMany({ where: { userId } }),
        prisma.userInteraction.findMany({
          where: { userId, interactionType: { in: ["CHOSEN", "EATEN"] }, createdAt: { gt: since } },
          select: { dishId: true },
        }),
        prisma.recipeInteraction.findMany({
          where: { userId, interactionType: { in: ["CHOSEN", "EATEN"] }, createdAt: { gt: since } },
          select: { canonicalName: true, canonicalDishId: true },
        }),
        providedPlaces
          ? Promise.resolve(providedPlaces)
          : discovery.restaurants(userId, "quán ăn", undefined, context, context.radius),
      ]);
      const disliked = new Set(
        preferences.filter((item) => item.preference === "DISLIKED").map((item) => item.dishId),
      );
      const liked = new Set(
        preferences.filter((item) => item.preference === "LIKED").map((item) => item.dishId),
      );
      const recentIds = new Set([
          ...recent.map((item) => item.dishId),
          ...recipes.map((item) => item.canonicalDishId).filter((id) => id !== null),
        ]),
        recentNames = new Set(recipes.map((item) => item.canonicalName));
      const constraints = {
        allergies: profile?.allergies.map((item) => item.code) ?? [],
        diets:
          profile?.dietaryRestrictions
            .filter((item) => item.isMandatory)
            .map((item) => item.code) ?? [],
      };
      const feedbackSince = new Date(+now - 180 * 86400000);
      const [dishFeedback, recipeFeedback] = await Promise.all([
        prisma.userInteraction.findMany({
          where: {
            userId,
            interactionType: { in: ["RATED", "LIKED", "SKIPPED"] },
            createdAt: { gte: feedbackSince },
          },
          select: { id: true, dishId: true, interactionType: true, rating: true, createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 500,
        }),
        prisma.recipeInteraction.findMany({
          where: {
            userId,
            interactionType: { in: ["RATED", "LIKED", "SKIPPED"] },
            createdAt: { gte: feedbackSince },
          },
          select: {
            id: true,
            canonicalDishId: true,
            canonicalName: true,
            interactionType: true,
            rating: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 500,
        }),
      ]);
      const feedback = feedbackScores([
        ...dishFeedback.map((row) => ({
          key: `dish:${row.dishId}`,
          type: row.interactionType,
          rating: row.rating,
          at: row.createdAt,
          id: row.id,
        })),
        ...recipeFeedback.map((row) => ({
          key: row.canonicalDishId ? `dish:${row.canonicalDishId}` : `name:${row.canonicalName}`,
          type: row.interactionType,
          rating: row.rating,
          at: row.createdAt,
          id: row.id,
        })),
      ]);
      let safetyBlocked = 0;
      const candidates = offers.slice(0, 500).flatMap((offer) => {
        const dish = offer.dish!;
        if (
          disliked.has(dish.id) ||
          recentIds.has(dish.id) ||
          recentNames.has(foodIdentity(dish.name)) ||
          dish.aliases.some((alias) => recentNames.has(foodIdentity(alias.normalizedAlias)))
        )
          return [];
        const restaurant = offer.identity.restaurant,
          supplier = offer.identity.supplier;
        if (
          +now - +offer.observedAt > supplier.maxEvidenceAgeHours * 3600000 ||
          +offer.expiresAt - +offer.observedAt > supplier.maxEvidenceAgeHours * 3600000
        )
          return [];
        const distance = distanceMeters(context, {
          latitude: Number(restaurant.latitude),
          longitude: Number(restaurant.longitude),
        });
        if (distance > context.radius) return [];
        const live = places.items.find(
          (place) => place.source === "google" && place.placeId === restaurant.googlePlaceId,
        );
        if (live?.openNow === false || (context.onlyOpen && live?.openNow !== true)) return [];
        const evidence = offer.evidence.filter(
          (fact) =>
            +now - +fact.observedAt <= supplier.maxEvidenceAgeHours * 3600000 &&
            +fact.expiresAt - +fact.observedAt <= supplier.maxEvidenceAgeHours * 3600000,
        );
        if (!safetyDecision(evidence, constraints, now, offer.observedAt).eligible) {
          safetyBlocked++;
          return [];
        }
        const taste =
          profile && !pending
            ? 1 -
              (["spicyLevel", "sweetLevel", "sourLevel", "saltyLevel"] as const).reduce(
                (sum, key) => sum + Math.abs(dish[key] - profile[key]),
                0,
              ) /
                400
            : 0.5;
        const cuisine =
          profile && !pending
            ? Math.max(
                0,
                Math.min(
                  1,
                  (profile.cuisinePreferences.find((item) => item.code === dish.cuisine.code)
                    ?.preferenceScore ?? 0) / 100,
                ),
              )
            : 0;
        const feedbackAdjustment = Math.max(
          -0.3,
          Math.min(
            0.3,
            (feedback.get(`dish:${dish.id}`) ?? 0) +
              (feedback.get(`name:${foodIdentity(dish.name)}`) ?? 0),
          ),
        );
        const score = applyFeedback(
          normalizedScore(
            {
              taste,
              cuisine,
              distance: 1 - distance / context.radius,
              budget: 1 - offer.price / context.budget,
              rating: live?.rating == null ? 0.5 : live.rating / 5,
              novelty: liked.has(dish.id) ? 1 : 0.5,
            },
            weights,
          ),
          feedbackAdjustment,
        );
        const reasons = [
          "BUDGET_MATCH",
          "NEARBY",
          ...(feedbackAdjustment > 0 ? ["FEEDBACK_MATCH"] : []),
          ...(taste >= 0.8 && !pending && profile ? ["TASTE_MATCH"] : []),
          ...(cuisine > 0 ? ["CUISINE_MATCH"] : []),
          ...(liked.has(dish.id) ? ["LIKED"] : []),
        ];
        return [
          {
            id: offer.id,
            offerId: offer.id,
            dishId: dish.id,
            restaurantId: restaurant.id,
            title: offer.title,
            canonicalName: foodIdentity(dish.name),
            canonicalAliases: dish.aliases.map((alias) => foodIdentity(alias.normalizedAlias)),
            optionLabel: offer.optionLabel,
            restaurantName: restaurant.name,
            address: restaurant.address,
            price: offer.price,
            expiresAt: offer.expiresAt.toISOString(),
            observedAt: offer.observedAt.toISOString(),
            verifiedAt: offer.observedAt.toISOString(),
            menuSource: offer.sourceUrl,
            budgetVerified: true,
            menuConfirmed: true,
            mediaKind: "VENUE",
            distanceMeters: distance,
            rating: live?.rating ?? null,
            ratingCount: live?.ratingCount ?? null,
            photo: live?.photo ?? null,
            attributions: live?.attributions ?? [],
            openNow: live?.openNow ?? null,
            mapsUrl:
              live?.mapsUrl ??
              `https://www.google.com/maps/search/?api=1&query=${Number(restaurant.latitude)},${Number(restaurant.longitude)}`,
            score,
            reasons,
            reason: reasons
              .slice(0, 3)
              .map((code) => groundedReasons[code as keyof typeof groundedReasons])
              .join(". "),
            warnings: [
              ...(live?.openNow == null ? ["OPENING_UNCONFIRMED"] : []),
              ...(constraints.allergies.length || constraints.diets.length
                ? ["RECONFIRM_PREPARATION_WITH_VENUE"]
                : ["INGREDIENTS_NOT_ASSESSED"]),
            ],
          },
        ];
      });
      return {
        status: candidates.length ? "SUCCESS" : safetyBlocked > 0 ? "NO_SAFE_MATCH" : "NO_MATCH",
        items: diversify(candidates),
        restaurants: places.items,
        sources: places.sources,
        candidateLimitReached: offers.length > 500,
        profileToken,
      };
    },
  };
}
