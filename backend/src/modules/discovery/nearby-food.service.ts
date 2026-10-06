import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { createDiscoveryService } from "./discovery.service.js";
import { distanceMeters, REPEAT_WINDOW_MS } from "../food/food.policy.js";
import { foodIdentity } from "../food/food.identity.js";
import { normalizeFoodText } from "../food/food.schema.js";
import { type Location, type Place } from "./place.providers.js";
import { createCandidateService } from "../recommendations/candidate.service.js";
export function createNearbyFoodService(
  prisma: PrismaClient,
  env = process.env,
  fetcher: typeof fetch = fetch,
) {
  const discovery = createDiscoveryService(prisma, env, fetcher);
  const candidateService = createCandidateService(prisma, env, fetcher);
  return {
    async search(
      userId: string,
      budget: number,
      location?: Location,
      radius = 3500,
      now = new Date(),
      onlyOpen = false,
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
          "Cho phép dùng vị trí hiện tại để tìm món quanh bạn",
        );
      const since = new Date(now.getTime() - REPEAT_WINDOW_MS);
      // Limit the database candidates geographically before applying the row cap.
      // Longitude bounds wrap across the date line; near a pole all longitudes qualify.
      const latitudeRadians = (origin.latitude * Math.PI) / 180;
      const angularRadius = radius / 6371000;
      const latitudeMin = Math.max(-90, ((latitudeRadians - angularRadius) * 180) / Math.PI);
      const latitudeMax = Math.min(90, ((latitudeRadians + angularRadius) * 180) / Math.PI);
      const longitudeDelta =
        latitudeMin <= -90 || latitudeMax >= 90
          ? 180
          : (Math.asin(Math.sin(angularRadius) / Math.cos(latitudeRadians)) * 180) / Math.PI;
      const longitudeMin = origin.longitude - longitudeDelta;
      const longitudeMax = origin.longitude + longitudeDelta;
      const geographicBounds = {
        latitude: { gte: latitudeMin, lte: latitudeMax },
        ...(longitudeDelta >= 180
          ? {}
          : longitudeMin < -180
            ? {
                OR: [
                  { longitude: { gte: longitudeMin + 360 } },
                  { longitude: { lte: longitudeMax } },
                ],
              }
            : longitudeMax > 180
              ? {
                  OR: [
                    { longitude: { gte: longitudeMin } },
                    { longitude: { lte: longitudeMax - 360 } },
                  ],
                }
              : { longitude: { gte: longitudeMin, lte: longitudeMax } }),
      };
      const [places, menus, history, recipeHistory, preferences] = await Promise.all([
        discovery.restaurants(userId, "quán ăn", undefined, origin, radius),
        prisma.restaurantDish.findMany({
          where: {
            isAvailable: true,
            price: { lte: budget },
            verifiedAt: { gte: new Date(now.getTime() - 86400000) },
            source: { startsWith: "https://" },
            restaurant: { businessStatus: "OPERATIONAL", ...geographicBounds },
          },
          include: { dish: { include: { aliases: true } }, restaurant: true },
          orderBy: [{ price: "asc" }, { dishId: "asc" }],
          take: 201,
        }),
        prisma.userInteraction.findMany({
          where: { userId, interactionType: { in: ["CHOSEN", "EATEN"] }, createdAt: { gt: since } },
          select: { dishId: true },
        }),
        prisma.recipeInteraction.findMany({
          where: { userId, interactionType: { in: ["CHOSEN", "EATEN"] }, createdAt: { gt: since } },
          select: { canonicalName: true, canonicalDishId: true },
        }),
        prisma.userDishPreference.findMany({
          where: { userId, preference: "DISLIKED" },
          select: { dishId: true },
        }),
      ]);
      const blockedIds = new Set([...history, ...preferences].map((row) => row.dishId));
      recipeHistory.forEach((row) => {
        if (row.canonicalDishId) blockedIds.add(row.canonicalDishId);
      });
      const blockedNames = new Set(recipeHistory.map((row) => row.canonicalName));
      const [allergyCount, dietCount] = await Promise.all([
        prisma.userAllergy.count({ where: { userId } }),
        prisma.userDietaryRestriction.count({ where: { userId, isMandatory: true } }),
      ]);
      const legacyItems = menus
        .slice(0, 200)
        .flatMap((menu) => {
          if (
            allergyCount > 0 ||
            dietCount > 0 ||
            blockedIds.has(menu.dishId) ||
            blockedNames.has(foodIdentity(menu.dish.name)) ||
            menu.dish.aliases.some((alias) => blockedNames.has(foodIdentity(alias.normalizedAlias)))
          )
            return [];
          const distance = distanceMeters(origin, {
            latitude: Number(menu.restaurant.latitude),
            longitude: Number(menu.restaurant.longitude),
          });
          if (distance > radius) return [];
          const live = places.items.find(
            (place) => place.source === "google" && place.placeId === menu.restaurant.googlePlaceId,
          );
          if (live?.openNow === false || (onlyOpen && live?.openNow !== true)) return [];
          return [
            {
              id: `menu:${menu.restaurantId}:${menu.dishId}`,
              dishId: menu.dishId,
              restaurantId: menu.restaurantId,
              title: menu.dish.name,
              canonicalName: foodIdentity(menu.dish.name),
              canonicalAliases: menu.dish.aliases.map((alias) =>
                foodIdentity(alias.normalizedAlias),
              ),
              restaurantName: menu.restaurant.name,
              address: menu.restaurant.address,
              price: menu.price,
              budgetVerified: true,
              menuConfirmed: true,
              menuSource: menu.source,
              verifiedAt: menu.verifiedAt,
              distanceMeters: distance,
              // Stored Google metadata can expire; show only freshly fetched review/photo metadata.
              rating: live?.rating ?? null,
              ratingCount: live?.ratingCount ?? null,
              photo: live?.photo ?? null,
              openNow: live?.openNow ?? null,
              mapsUrl:
                live?.mapsUrl ??
                `https://www.google.com/maps/search/?api=1&query=${Number(menu.restaurant.latitude)},${Number(menu.restaurant.longitude)}`,
            },
          ];
        })
        .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.distanceMeters - b.distanceMeters);
      const pool = await candidateService.pool(
        userId,
        { ...origin, budget, radius, onlyOpen },
        false,
        now,
        places,
      );
      const items = [
        ...pool.items,
        ...legacyItems.filter(
          (item) =>
            !pool.items.some(
              (offer) => offer.dishId === item.dishId && offer.restaurantId === item.restaurantId,
            ),
        ),
      ];
      const seen = new Set<string>();
      const restaurants: Place[] = places.items.filter((place) => {
        const key = `${normalizeFoodText(place.name)}:${normalizeFoodText(place.address || `${place.source}:${place.placeId}`)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return {
        status: items.length || restaurants.length ? "SUCCESS" : places.status,
        items,
        restaurants,
        sources: places.sources,
        budget,
        radiusMeters: radius,
        updatedAt: now.toISOString(),
        repeatAfterHours: 96,
        candidateLimitReached: menus.length > 200 || pool.candidateLimitReached,
        notice:
          "Giá chỉ được xác nhận khi có thực đơn nguồn còn mới. Đánh giá và ảnh là của quán; chưa phải đánh giá riêng từng món.",
      };
    },
  };
}
