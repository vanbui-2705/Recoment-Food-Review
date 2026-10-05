import { AppError } from "../../common/errors/app-error.js";
import { distanceMeters } from "../food/food.policy.js";
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
      let response: Response;
      try {
        response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          signal: AbortSignal.timeout(6000),
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.currentOpeningHours.openNow,places.attributions",
          },
          body: JSON.stringify({
            textQuery: dishName,
            includedType: "restaurant",
            languageCode: "vi",
            pageSize: 10,
            locationBias: { circle: { center: location, radius: Math.min(radius, 50000) } },
          }),
        });
      } catch {
        throw new AppError(
          503,
          "PLACES_UNAVAILABLE",
          "Không kết nối được nguồn quán, vui lòng thử lại",
        );
      }
      if (!response.ok)
        throw new AppError(503, "PLACES_UNAVAILABLE", "Nguồn quán tạm thời không khả dụng");
      let payload: { places?: GooglePlace[] };
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        throw new AppError(503, "PLACES_UNAVAILABLE", "Nguồn quán trả dữ liệu không hợp lệ");
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
            typeof p.displayName?.text === "string" &&
            p.businessStatus === "OPERATIONAL",
        )
        .map((p) => ({
          placeId: p.id!,
          name: p.displayName!.text!,
          address: p.formattedAddress ?? null,
          distanceMeters: distanceMeters(location, p.location!),
          rating: p.rating ?? null,
          ratingCount: p.userRatingCount ?? null,
          openNow: p.currentOpeningHours?.openNow ?? null,
          mapsUrl:
            (p.googleMapsUri?.startsWith("https://") ? p.googleMapsUri : undefined) ??
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dishName)}&query_place_id=${encodeURIComponent(p.id!)}`,
          attributions: p.attributions ?? [],
          menuConfirmed: false,
          price: null,
        }))
        .filter((p) => p.distanceMeters <= radius)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    },
  };
}
