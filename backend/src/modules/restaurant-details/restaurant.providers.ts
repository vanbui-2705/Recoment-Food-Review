import { AppError } from "../../common/errors/app-error.js";
import {
  object,
  list,
  string,
  number,
  safeUrl,
  providerJson,
  ProviderError,
} from "../discovery/provider.http.js";
export type DetailSource = "google" | "goong" | "foursquare" | "geoapify";
const keys: Record<DetailSource, string> = {
  google: "GOOGLE_PLACES_API_KEY",
  goong: "GOONG_API_KEY",
  foursquare: "FOURSQUARE_API_KEY",
  geoapify: "GEOAPIFY_API_KEY",
};
function publicLink(value: unknown) {
  const url = safeUrl(value);
  return url &&
    !new URL(url).hash &&
    ![...new URL(url).searchParams.keys()].some((k) => /key|token|secret|auth|signature/i.test(k))
    ? url
    : null;
}
export function createRestaurantProviders(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
) {
  return {
    async detail(source: DetailSource, externalId: string) {
      const key = env[keys[source]]?.trim();
      if (!key)
        throw new AppError(503, "PLACES_NOT_CONFIGURED", "Nguồn chi tiết quán chưa được kết nối");
      try {
        let data: Record<string, unknown>;
        if (source === "google")
          data = await providerJson(
            source,
            `https://places.googleapis.com/v1/places/${encodeURIComponent(externalId)}?languageCode=vi`,
            {
              headers: {
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask":
                  "id,displayName,formattedAddress,location,rating,userRatingCount,googleMapsUri,businessStatus,currentOpeningHours,internationalPhoneNumber,websiteUri,photos,attributions",
              },
            },
            fetcher,
          );
        else if (source === "goong") {
          const url = new URL("https://rsapi.goong.io/Place/Detail");
          url.searchParams.set("api_key", key);
          url.searchParams.set("place_id", externalId);
          const result = await providerJson(source, url.href, {}, fetcher);
          if (result.status !== "OK") throw new ProviderError("INVALID_DATA");
          data = object(result.result);
        } else if (source === "foursquare") {
          const url = new URL(
            `https://places-api.foursquare.com/places/${encodeURIComponent(externalId)}`,
          );
          url.searchParams.set(
            "fields",
            "fsq_place_id,name,location,latitude,longitude,date_closed",
          );
          data = await providerJson(
            source,
            url.href,
            { headers: { Authorization: `Bearer ${key}`, "X-Places-Api-Version": "2025-06-17" } },
            fetcher,
          );
        } else {
          const url = new URL("https://api.geoapify.com/v2/place-details");
          url.searchParams.set("id", externalId);
          url.searchParams.set("features", "details");
          url.searchParams.set("apiKey", key);
          const result = await providerJson(source, url.href, {}, fetcher);
          data = object(object(list(result.features)[0]).properties);
        }
        const location =
          source === "google"
            ? object(data.location)
            : source === "goong"
              ? object(object(data.geometry).location)
              : data;
        const latitude = number(
          source === "google" || source === "foursquare"
            ? location.latitude
            : source === "goong"
              ? location.lat
              : data.lat,
        );
        const longitude = number(
          source === "google" || source === "foursquare"
            ? location.longitude
            : source === "goong"
              ? location.lng
              : data.lon,
        );
        const name =
          source === "google" ? string(object(data.displayName).text) : string(data.name);
        const returnedId =
          source === "google"
            ? string(data.id)
            : source === "goong"
              ? string(data.place_id)
              : source === "foursquare"
                ? string(data.fsq_place_id)
                : string(data.place_id);
        if (
          !name.trim() ||
          returnedId !== externalId ||
          latitude === null ||
          longitude === null ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180
        )
          throw new ProviderError("INVALID_DATA");
        const opening = object(data.currentOpeningHours),
          rating = number(data.rating),
          count = number(data.userRatingCount);
        const photo = object(list(data.photos)[0]);
        const photoName = string(photo.name);
        const phone = string(data.internationalPhoneNumber);
        return {
          source,
          externalId,
          name: name.slice(0, 200),
          address:
            (source === "foursquare"
              ? string(object(data.location).formatted_address)
              : string(data.formattedAddress || data.formatted_address || data.formatted)
            ).slice(0, 500) || null,
          latitude,
          longitude,
          rating:
            source === "google" && rating !== null && rating >= 0 && rating <= 5 ? rating : null,
          ratingCount:
            source === "google" && count !== null && Number.isSafeInteger(count) && count >= 0
              ? count
              : null,
          openNow: typeof opening.openNow === "boolean" ? opening.openNow : null,
          businessStatus:
            source === "google"
              ? (
                  {
                    OPERATIONAL: "OPERATIONAL",
                    CLOSED_TEMPORARILY: "TEMPORARILY_CLOSED",
                    CLOSED_PERMANENTLY: "PERMANENTLY_CLOSED",
                  } as Record<string, string>
                )[string(data.businessStatus)] || "UNKNOWN"
              : data.date_closed
                ? "PERMANENTLY_CLOSED"
                : "UNKNOWN",
          openingHours: list(opening.weekdayDescriptions)
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.slice(0, 200))
            .slice(0, 7),
          phone: /^\+?[0-9 ()-]{6,30}$/.test(phone) ? phone : null,
          websiteUrl: publicLink(data.websiteUri),
          mapsUrl:
            publicLink(data.googleMapsUri) ||
            `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
          photo:
            source === "google" &&
            /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photoName) &&
            photoName.length <= 1000
              ? {
                  name: photoName,
                  authors: list(photo.authorAttributions)
                    .map((v) => ({
                      name: string(object(v).displayName),
                      url: publicLink(object(v).uri),
                    }))
                    .filter((v) => v.name),
                }
              : null,
          attributions:
            source === "google"
              ? [
                  { provider: "Google Maps", providerUri: "https://maps.google.com/" },
                  ...list(data.attributions)
                    .map((v) => ({
                      provider: string(object(v).provider),
                      providerUri: publicLink(object(v).providerUri),
                    }))
                    .filter((v) => v.provider),
                ]
              : [
                  { provider: source, providerUri: null },
                  ...(source === "geoapify"
                    ? [
                        {
                          provider: "© OpenStreetMap contributors",
                          providerUri: "https://www.openstreetmap.org/copyright",
                        },
                      ]
                    : []),
                ],
          updatedAt: new Date().toISOString(),
          mediaKind: "VENUE" as const,
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          503,
          err instanceof ProviderError && err.status === "QUOTA_EXCEEDED"
            ? "PLACES_QUOTA_EXCEEDED"
            : "PLACES_UNAVAILABLE",
          "Chưa tải được chi tiết quán. Hãy thử lại sau",
        );
      }
    },
  };
}
