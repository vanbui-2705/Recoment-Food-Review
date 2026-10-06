import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { createCandidateService, type RecommendationContext } from "./candidate.service.js";
import { createGeminiProvider, type StructuredAiProvider } from "../ai/ai.provider.js";
import { loadAiConfig } from "../ai/ai.config.js";
import { rerank, groundedReasons } from "./recommendation.policy.js";
import { REPEAT_WINDOW_MS, distanceMeters } from "../food/food.policy.js";
import { foodIdentity } from "../food/food.identity.js";
import { safetyDecision } from "../merchant-menu/safety.policy.js";
import { createDiscoveryService } from "../discovery/discovery.service.js";
import type { Place } from "../discovery/place.providers.js";
import { performance } from "node:perf_hooks";
import { recordRecommendation } from "../../common/observability/metrics.js";

export type RecommendationInput = Partial<RecommendationContext> & { idempotencyKey: string };
export function createRecommendationService(
  prisma: PrismaClient,
  env = process.env,
  fetcher: typeof fetch = fetch,
  injectedProvider?: StructuredAiProvider,
) {
  const candidates = createCandidateService(prisma, env, fetcher);
  const config = loadAiConfig(env),
    provider = injectedProvider ?? createGeminiProvider(config, fetcher);
  const discovery = createDiscoveryService(prisma, env, fetcher);
  const get = async (userId: string, id: string, verifiedPlaces?: Place[]) => {
    const now = new Date();
    const request = await prisma.recommendationRequest.findFirst({
      where: { id, userId },
      include: {
        results: {
          orderBy: { rank: "asc" },
          include: {
            dish: { include: { aliases: true } },
            offer: {
              include: {
                identity: { include: { restaurant: true, supplier: true } },
                evidence: true,
              },
            },
          },
        },
      },
    });
    if (!request)
      throw new AppError(404, "RECOMMENDATION_NOT_FOUND", "Không tìm thấy lượt gợi ý của bạn");
    const openingPlaces =
      verifiedPlaces ??
      (request.onlyOpen
        ? (
            await discovery.restaurants(
              userId,
              "quán ăn",
              undefined,
              { latitude: Number(request.latitude), longitude: Number(request.longitude) },
              request.maxDistanceMeters ?? 3500,
            )
          ).items
        : []);
    const [note, allergies, diets, history, recipes, dislikes] = await Promise.all([
      prisma.personalFoodKnowledge.findUnique({ where: { userId } }),
      prisma.userAllergy.findMany({ where: { userId }, include: { allergen: true } }),
      prisma.userDietaryRestriction.findMany({
        where: { userId, isMandatory: true },
        include: { dietaryRestriction: true },
      }),
      prisma.userInteraction.findMany({
        where: {
          userId,
          createdAt: { gt: new Date(+now - REPEAT_WINDOW_MS) },
          interactionType: { in: ["CHOSEN", "EATEN"] },
        },
        select: { dishId: true },
      }),
      prisma.recipeInteraction.findMany({
        where: {
          userId,
          interactionType: { in: ["CHOSEN", "EATEN"] },
          createdAt: { gt: new Date(+now - REPEAT_WINDOW_MS) },
        },
        select: { canonicalName: true, canonicalDishId: true },
      }),
      prisma.userDishPreference.findMany({
        where: { userId, preference: "DISLIKED" },
        select: { dishId: true },
      }),
    ]);
    const blocked = new Set(
        [...history, ...dislikes]
          .map((item) => item.dishId)
          .concat(recipes.flatMap((item) => (item.canonicalDishId ? [item.canonicalDishId] : []))),
      ),
      names = new Set(recipes.map((item) => item.canonicalName));
    const profileCurrent =
      (note?.revision ?? 0) === (request.profileRevision ?? 0) &&
      (!note || note.analyzedRevision === note.revision);
    const constraints = {
      allergies: allergies.map((item) => item.allergen.code),
      diets: diets.map((item) => item.dietaryRestriction.code),
    };
    const items = request.results.map((result) => {
      const offer = result.offer,
        supplier = offer?.identity.supplier;
      const fresh =
        !!offer &&
        !!supplier &&
        !!result.expiresAt &&
        result.expiresAt > now &&
        offer.expiresAt > now &&
        offer.observedAt <= now &&
        +now - +offer.observedAt <= supplier.maxEvidenceAgeHours * 3600000 &&
        +offer.expiresAt - +offer.observedAt <= supplier.maxEvidenceAgeHours * 3600000 &&
        offer.price === result.price;
      const safety =
        !!offer &&
        !!supplier &&
        safetyDecision(
          offer.evidence.filter(
            (fact) =>
              +now - +fact.observedAt <= supplier.maxEvidenceAgeHours * 3600000 &&
              +fact.expiresAt - +fact.observedAt <= supplier.maxEvidenceAgeHours * 3600000,
          ),
          constraints,
          now,
          offer.observedAt,
        ).eligible;
      const coolingDown =
        blocked.has(result.dishId) ||
        names.has(foodIdentity(result.dish.name)) ||
        result.dish.aliases.some((alias) => names.has(foodIdentity(alias.normalizedAlias)));
      const restaurant = offer?.identity.restaurant;
      const liveOpening = openingPlaces.find(
        (place) => place.source === "google" && place.placeId === restaurant?.googlePlaceId,
      )?.openNow;
      const currentEligible = !!(
        fresh &&
        safety &&
        profileCurrent &&
        !coolingDown &&
        offer?.active &&
        offer.isAvailable &&
        offer.mappingStatus === "APPROVED" &&
        offer.dishId === result.dishId &&
        supplier?.enabled &&
        restaurant &&
        liveOpening !== false &&
        (!request.onlyOpen || liveOpening === true) &&
        !["PERMANENTLY_CLOSED", "TEMPORARILY_CLOSED"].includes(restaurant.businessStatus)
      );
      return {
        id: result.id,
        offerId: result.offerId,
        dishId: result.dishId,
        restaurantId: result.restaurantId,
        title: offer?.title ?? result.dish.name,
        canonicalName: foodIdentity(result.dish.name),
        canonicalAliases: result.dish.aliases.map((alias) => foodIdentity(alias.normalizedAlias)),
        optionLabel: offer?.optionLabel ?? null,
        restaurantName: restaurant?.name ?? null,
        address: restaurant?.address ?? null,
        price: fresh ? result.price : null,
        snapshotPrice: result.price,
        expiresAt: result.expiresAt,
        verifiedAt: offer?.observedAt,
        menuSource: offer?.sourceUrl ?? null,
        menuConfirmed: !!offer,
        budgetVerified: fresh,
        currentEligible,
        fresh,
        score: Number(result.finalScore),
        rank: result.rank,
        reason: result.reason,
        warnings: result.safetyWarnings,
        mediaKind: "VENUE",
        rating: null,
        ratingCount: null,
        photo: null,
        openNow: liveOpening ?? null,
        distanceMeters: restaurant
          ? distanceMeters(
              { latitude: Number(request.latitude), longitude: Number(request.longitude) },
              { latitude: Number(restaurant.latitude), longitude: Number(restaurant.longitude) },
            )
          : null,
        mapsUrl: restaurant
          ? `https://www.google.com/maps/search/?api=1&query=${Number(restaurant.latitude)},${Number(restaurant.longitude)}`
          : null,
      };
    });
    return {
      id: request.id,
      status: request.outcomeCode ?? request.status,
      processingState: request.processingState,
      rankingStatus: request.rankingStatus,
      requestedAt: request.requestedAt,
      budget: request.budgetMax,
      radiusMeters: request.maxDistanceMeters,
      repeatAfterHours: 96,
      historical: true,
      items,
    };
  };
  return {
    get,
    async recommend(userId: string, input: RecommendationInput) {
      const started = performance.now();
      let outcome = "FAILED";
      try {
        const hash = createHash("sha256")
          .update(
            JSON.stringify({
              budget: input.budget ?? null,
              radius: input.radius ?? null,
              latitude: input.latitude ?? null,
              longitude: input.longitude ?? null,
              onlyOpen: input.onlyOpen ?? false,
            }),
          )
          .digest("hex");
        const context = await candidates.context(userId, input);
        const key = `${userId}:${input.idempotencyKey}`,
          token = randomUUID(),
          now = new Date();
        const leaseUntil = new Date(+now + Math.max(120, config.leaseSeconds) * 1000);
        const reservation = await prisma.$transaction(async (tx) => {
          const created = await tx.recommendationRequest.createMany({
            data: [
              {
                userId,
                idempotencyKey: key,
                inputHash: hash,
                latitude: context.latitude,
                longitude: context.longitude,
                budgetMin: 0,
                budgetMax: context.budget,
                maxDistanceMeters: context.radius,
                onlyOpen: context.onlyOpen ?? false,
                status: "FAILED",
                processingState: "IN_PROGRESS",
                leaseToken: token,
                leaseUntil,
              },
            ],
            skipDuplicates: true,
          });
          const row = await tx.recommendationRequest.findUniqueOrThrow({
            where: { idempotencyKey: key },
          });
          if (row.inputHash !== hash)
            throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Mã thao tác đã dùng với yêu cầu khác");
          if (created.count === 1) return { id: row.id, replayed: false };
          if (row.processingState === "COMPLETED") return { id: row.id, replayed: true };
          const claimed = await tx.recommendationRequest.updateMany({
            where: {
              id: row.id,
              OR: [
                { processingState: "FAILED" },
                { processingState: "IN_PROGRESS", leaseUntil: { lt: now } },
              ],
            },
            data: {
              processingState: "IN_PROGRESS",
              leaseToken: token,
              leaseUntil,
              latitude: context.latitude,
              longitude: context.longitude,
              budgetMax: context.budget,
              maxDistanceMeters: context.radius,
              onlyOpen: context.onlyOpen ?? false,
              requestedAt: now,
              status: "FAILED",
              outcomeCode: null,
            },
          });
          if (!claimed.count)
            throw new AppError(
              409,
              "RECOMMENDATION_IN_PROGRESS",
              "Yêu cầu đang xử lý; hãy chờ rồi thử lại",
            );
          return { id: row.id, replayed: false };
        });
        if (reservation.replayed) {
          const snapshot = await get(userId, reservation.id);
          const items = snapshot.items.filter((item) => item.currentEligible);
          outcome = snapshot.status === "SUCCESS" && !items.length ? "NO_MATCH" : snapshot.status;
          return {
            ...snapshot,
            status: outcome,
            historical: false,
            replayed: true,
            items,
          };
        }
        try {
          const pool = await candidates.pool(userId, context);
          const ranked = await rerank(pool.items, provider, async () => {
            const day = new Date().toISOString().slice(0, 10);
            const reserved = await prisma.$queryRaw<
              Array<{ requests: number }>
            >`INSERT INTO ai_request_usage(day, requests) VALUES (${day}, 1) ON CONFLICT(day) DO UPDATE SET requests = ai_request_usage.requests + 1 WHERE ai_request_usage.requests < ${config.dailyRequests} RETURNING requests`;
            return reserved.length > 0;
          });
          await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM recommendation_requests WHERE id = ${reservation.id}::uuid FOR UPDATE`;
            const owned = await tx.recommendationRequest.findUniqueOrThrow({
              where: { id: reservation.id },
            });
            if (owned.leaseToken !== token)
              throw new AppError(
                409,
                "RECOMMENDATION_SUPERSEDED",
                "Lượt xử lý này đã được thay thế",
              );
            await tx.$queryRaw`SELECT user_id FROM personal_food_knowledge WHERE user_id = ${userId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM taste_profiles WHERE user_id = ${userId}::uuid FOR UPDATE`;
            const [note, profile] = await Promise.all([
              tx.personalFoodKnowledge.findUnique({ where: { userId } }),
              tx.tasteProfile.findUnique({ where: { userId } }),
            ]);
            if (
              (note?.revision ?? 0) !== pool.profileToken.revision ||
              (note?.analyzedRevision ?? 0) !== pool.profileToken.analyzedRevision ||
              (profile?.updatedAt.toISOString() ?? null) !== pool.profileToken.updatedAt
            )
              throw new AppError(
                409,
                "RECOMMENDATION_PROFILE_CHANGED",
                "Khẩu vị đã thay đổi trong lúc tìm; hãy tìm lại",
              );
            await tx.recommendationResult.deleteMany({ where: { requestId: reservation.id } });
            if (ranked.items.length)
              await tx.recommendationResult.createMany({
                data: ranked.items.map((candidate, index) => ({
                  requestId: reservation.id,
                  dishId: candidate.dishId,
                  restaurantId: candidate.restaurantId,
                  offerId: candidate.offerId,
                  rank: index + 1,
                  price: candidate.price,
                  expiresAt: new Date(candidate.expiresAt),
                  baseScore: candidate.score,
                  finalScore: candidate.score,
                  reason: candidate.reasons
                    .slice(0, 3)
                    .map((code) => groundedReasons[code as keyof typeof groundedReasons])
                    .join(". "),
                  safetyWarnings: candidate.warnings as Prisma.InputJsonValue,
                })),
              });
            await tx.recommendationRequest.update({
              where: { id: reservation.id },
              data: {
                status:
                  pool.status === "SUCCESS"
                    ? "SUCCESS"
                    : pool.status === "NO_SAFE_MATCH"
                      ? "NO_SAFE_MATCH"
                      : pool.status === "NO_MATCH"
                        ? "NO_MATCH"
                        : "INSUFFICIENT_DATA",
                outcomeCode: pool.status,
                profileRevision: pool.profileToken.revision,
                rankingStatus: ranked.status,
                processingState: "COMPLETED",
                leaseToken: null,
                leaseUntil: null,
              },
            });
          });
          const stored = await get(userId, reservation.id, pool.restaurants);
          const transient = new Map(pool.items.map((candidate) => [candidate.offerId, candidate]));
          outcome =
            stored.status === "SUCCESS" && !stored.items.some((item) => item.currentEligible)
              ? "NO_MATCH"
              : stored.status;
          return {
            ...stored,
            status: outcome,
            historical: false,
            items: stored.items
              .filter((item) => item.currentEligible)
              .map((item) => {
                const live = transient.get(item.offerId!);
                return {
                  ...item,
                  rating: live?.rating ?? null,
                  ratingCount: live?.ratingCount ?? null,
                  photo: live?.photo ?? null,
                  openNow: live?.openNow ?? null,
                  attributions: live?.attributions ?? [],
                };
              }),
            restaurants: pool.restaurants,
            sources: pool.sources,
            candidateLimitReached: pool.candidateLimitReached,
          };
        } catch (error) {
          await prisma.recommendationRequest.updateMany({
            where: { id: reservation.id, leaseToken: token },
            data: { processingState: "FAILED", leaseToken: null, leaseUntil: null },
          });
          throw error;
        }
      } finally {
        recordRecommendation(outcome, performance.now() - started);
      }
    },
  };
}
