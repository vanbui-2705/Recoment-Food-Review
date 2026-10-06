import { AppError } from "../../common/errors/app-error.js";
import { distanceMeters } from "../food/food.policy.js";
import {
  providerJson,
  ProviderError,
  safeUrl,
  object,
  list,
  string,
} from "../discovery/provider.http.js";
type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: string;
  currentOpeningHours?: { openNow?: boolean };
  attributions?: Array<{ provider?: string; providerUri?: string }>;
  photos?: unknown[];
};
export function createPlacesAdapter(
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
  fetcher: typeof fetch = fetch,
) {
  return {
    async search(
      dishName: string,
      location: { latitude: number; longitude: number },
      radius: number,
    ) {
      if (!apiKey) throw new AppError(503, "PLACES_NOT_CONFIGURED", "Tìm quán chưa được cấu hình");
      let payload: { places?: GooglePlace[] };
      try {
        payload = await providerJson(
          "google",
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.currentOpeningHours.openNow,places.attributions,places.photos",
            },
            body: JSON.stringify({
              textQuery: dishName,
              includedType: "restaurant",
              languageCode: "vi",
              pageSize: 10,
              locationBias: { circle: { center: location, radius: Math.min(radius, 50000) } },
            }),
          },
          fetcher,
        );
      } catch (error) {
        throw new AppError(
          503,
          error instanceof ProviderError && error.status === "QUOTA_EXCEEDED"
            ? "PLACES_QUOTA_EXCEEDED"
            : "PLACES_UNAVAILABLE",
          "Không kết nối được nguồn quán, vui lòng thử lại",
        );
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        (payload.places && !Array.isArray(payload.places))
      )
        throw new AppError(503, "PLACES_UNAVAILABLE", "Nguồn quán trả dữ liệu không hợp lệ");
      return (payload.places ?? [])
        .filter(
          (p) =>
            p &&
            typeof p.id === "string" &&
            p.location &&
            Number.isFinite(p.location.latitude) &&
            Number.isFinite(p.location.longitude) &&
            Math.abs(p.location.latitude) <= 90 &&
            Math.abs(p.location.longitude) <= 180 &&
            typeof p.displayName?.text === "string" &&
            p.businessStatus === "OPERATIONAL",
        )
        .map((p) => ({
          placeId: p.id!,
          name: p.displayName!.text!,
          address: typeof p.formattedAddress === "string" ? p.formattedAddress : null,
          distanceMeters: distanceMeters(location, p.location!),
          rating:
            typeof p.rating === "number" &&
            Number.isFinite(p.rating) &&
            p.rating >= 0 &&
            p.rating <= 5
              ? p.rating
              : null,
          ratingCount:
            typeof p.userRatingCount === "number" &&
            Number.isSafeInteger(p.userRatingCount) &&
            p.userRatingCount >= 0
              ? p.userRatingCount
              : null,
          openNow:
            typeof p.currentOpeningHours?.openNow === "boolean"
              ? p.currentOpeningHours.openNow
              : null,
          mapsUrl:
            safeUrl(p.googleMapsUri) ??
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dishName)}&query_place_id=${encodeURIComponent(p.id!)}`,
          attributions: Array.isArray(p.attributions)
            ? p.attributions
                .filter((a) => a && typeof a.provider === "string")
                .map((a) => ({
                  provider: a.provider!,
                  providerUri: safeUrl(a.providerUri) ?? undefined,
                }))
            : [],
          menuConfirmed: false,
          price: null,
          photo: (() => {
            const photo = object(list(p.photos)[0]);
            const name = string(photo.name);
            if (
              !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name) ||
              name.length > 1000
            )
              return null;
            return {
              name,
              authors: list(photo.authorAttributions)
                .map((value) => {
                  const author = object(value);
                  const uri = string(author.uri);
                  return {
                    name: string(author.displayName),
                    url: safeUrl(uri.startsWith("//") ? `https:${uri}` : uri),
                  };
                })
                .filter((author) => !!author.name),
            };
          })(),
        }))
        .filter((p) => p.distanceMeters <= radius)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    },
  };
}
