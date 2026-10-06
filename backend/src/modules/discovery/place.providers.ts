import { createPlacesAdapter } from "../places/places.adapter.js";
import { distanceMeters } from "../food/food.policy.js";
import { object, string, number, safeUrl, providerJson, ProviderError } from "./provider.http.js";
export const placeSources = ["google", "goong", "foursquare", "geoapify"] as const;
export type PlaceSource = (typeof placeSources)[number];
export type Location = { latitude: number; longitude: number };
export type Place = {
  placeId: string;
  source: PlaceSource;
  name: string;
  address: string | null;
  distanceMeters: number;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  mapsUrl: string | null;
  attributions: { provider: string; providerUri: string | null }[];
  matchType: "DISH_QUERY" | "NEARBY_RESTAURANT";
  menuConfirmed: false;
  price: null;
};
const keyNames: Record<PlaceSource, string> = {
  google: "GOOGLE_PLACES_API_KEY",
  goong: "GOONG_API_KEY",
  foursquare: "FOURSQUARE_API_KEY",
  geoapify: "GEOAPIFY_API_KEY",
};
export function createPlaceProviders(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
) {
  const key = (source: PlaceSource) => env[keyNames[source]]?.trim();
  const make = (
    source: PlaceSource,
    id: unknown,
    name: unknown,
    address: unknown,
    lat: unknown,
    lng: unknown,
    origin: Location,
    radius: number,
  ): Place | null => {
    const latitude = number(lat);
    const longitude = number(lng);
    if (
      !string(id) ||
      !string(name).trim() ||
      latitude === null ||
      longitude === null ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      return null;
    const distance = distanceMeters(origin, { latitude, longitude });
    if (distance > radius) return null;
    return {
      placeId: string(id),
      source,
      name: string(name).slice(0, 250),
      address: string(address).slice(0, 500) || null,
      distanceMeters: distance,
      rating: null,
      ratingCount: null,
      openNow: null,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      attributions: [],
      matchType: source === "geoapify" ? "NEARBY_RESTAURANT" : "DISH_QUERY",
      menuConfirmed: false,
      price: null,
    };
  };
  return {
    configured: (source: PlaceSource) => !!key(source),
    async search(
      source: PlaceSource,
      query: string,
      origin: Location,
      radius: number,
    ): Promise<Place[]> {
      if (!key(source)) return [];
      if (source === "google") {
        return (await createPlacesAdapter(key(source), fetcher).search(query, origin, radius)).map(
          (p) => ({
            ...p,
            source,
            matchType: "DISH_QUERY" as const,
            menuConfirmed: false as const,
            attributions: p.attributions.map((a) => ({
              provider: a.provider ?? "Google Maps",
              providerUri: safeUrl(a.providerUri),
            })),
          }),
        );
      }
      if (source === "foursquare") {
        const url = new URL("https://places-api.foursquare.com/places/search");
        url.searchParams.set("query", query);
        url.searchParams.set("ll", `${origin.latitude},${origin.longitude}`);
        url.searchParams.set("radius", String(Math.min(radius, 100000)));
        url.searchParams.set("limit", "10");
        url.searchParams.set("fields", "fsq_place_id,name,location,latitude,longitude,date_closed");
        const data = await providerJson(
          source,
          url.href,
          {
            headers: {
              Authorization: `Bearer ${key(source)}`,
              "X-Places-Api-Version": "2025-06-17",
            },
          },
          fetcher,
        );
        if (!Array.isArray(data.results)) throw new ProviderError("INVALID_DATA");
        return data.results
          .map((v) => {
            const p = object(v);
            if (p.date_closed) return null;
            const place = make(
              source,
              p.fsq_place_id,
              p.name,
              object(p.location).formatted_address,
              p.latitude,
              p.longitude,
              origin,
              radius,
            );
            if (place) {
              place.mapsUrl = `https://foursquare.com/v/${encodeURIComponent(place.placeId)}`;
              place.attributions = [
                { provider: "Foursquare", providerUri: "https://foursquare.com/" },
              ];
            }
            return place;
          })
          .filter((p): p is Place => !!p);
      }
      if (source === "geoapify") {
        const url = new URL("https://api.geoapify.com/v2/places");
        url.searchParams.set("categories", "catering.restaurant");
        url.searchParams.set("filter", `circle:${origin.longitude},${origin.latitude},${radius}`);
        url.searchParams.set("bias", `proximity:${origin.longitude},${origin.latitude}`);
        url.searchParams.set("limit", "10");
        url.searchParams.set("apiKey", key(source)!);
        const data = await providerJson(source, url.href, {}, fetcher);
        if (!Array.isArray(data.features)) throw new ProviderError("INVALID_DATA");
        return data.features
          .map((v) => {
            const p = object(object(v).properties);
            const place = make(
              source,
              p.place_id,
              p.name,
              p.formatted,
              p.lat,
              p.lon,
              origin,
              radius,
            );
            if (place) {
              // Geoapify finds nearby restaurants; it does not support a dish-name menu search.
              place.mapsUrl = null;
              place.attributions = [
                { provider: "Geoapify", providerUri: "https://www.geoapify.com/" },
                {
                  provider: "© OpenStreetMap contributors",
                  providerUri: "https://www.openstreetmap.org/copyright",
                },
              ];
            }
            return place;
          })
          .filter((p): p is Place => !!p);
      }
      const url = new URL("https://rsapi.goong.io/Place/AutoComplete");
      url.searchParams.set("api_key", key(source)!);
      url.searchParams.set("input", query);
      url.searchParams.set("location", `${origin.latitude},${origin.longitude}`);
      url.searchParams.set("radius", String(radius / 1000));
      url.searchParams.set("limit", "5");
      const data = await providerJson(source, url.href, {}, fetcher);
      if (!Array.isArray(data.predictions) || data.status !== "OK")
        throw new ProviderError("INVALID_DATA");
      const results = await Promise.allSettled(
        data.predictions.slice(0, 5).map(async (v) => {
          const p = object(v);
          if (!string(p.place_id)) return null;
          const detailUrl = new URL("https://rsapi.goong.io/Place/Detail");
          detailUrl.searchParams.set("api_key", key(source)!);
          detailUrl.searchParams.set("place_id", string(p.place_id));
          const detail = await providerJson(source, detailUrl.href, {}, fetcher);
          if (detail.status !== "OK") throw new ProviderError("INVALID_DATA");
          const item = object(detail.result);
          const coords = object(object(item.geometry).location);
          const place = make(
            source,
            item.place_id,
            item.name,
            item.formatted_address,
            coords.lat,
            coords.lng,
            origin,
            radius,
          );
          if (place) place.attributions = [{ provider: "Goong", providerUri: "https://goong.io/" }];
          return place;
        }),
      );
      if (results.length && results.every((r) => r.status === "rejected"))
        throw new ProviderError("UNAVAILABLE");
      return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
    },
  };
}
