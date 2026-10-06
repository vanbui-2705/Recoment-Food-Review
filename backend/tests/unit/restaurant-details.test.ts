import { describe, expect, it, vi } from "vitest";
import { createRestaurantProviders } from "../../src/modules/restaurant-details/restaurant.providers.js";

const response = (value: unknown) => new Response(JSON.stringify(value));
describe("restaurant detail provider boundary", () => {
  it.each([
    [
      "google",
      "GOOGLE_PLACES_API_KEY",
      {
        id: "place_1",
        displayName: { text: "Quán thật" },
        location: { latitude: 10.77, longitude: 106.7 },
        rating: 4.4,
        userRatingCount: 20,
        photos: [
          {
            name: "places/place_1/photos/photo_1",
            authorAttributions: [{ displayName: "Tác giả", uri: "https://example.org/author" }],
          },
        ],
        currentOpeningHours: { openNow: true, weekdayDescriptions: ["Thứ Hai: 08–22h"] },
      },
    ],
    [
      "goong",
      "GOONG_API_KEY",
      {
        status: "OK",
        result: {
          place_id: "place_1",
          name: "Quán thật",
          geometry: { location: { lat: 10.77, lng: 106.7 } },
        },
      },
    ],
    [
      "foursquare",
      "FOURSQUARE_API_KEY",
      {
        fsq_place_id: "place_1",
        name: "Quán thật",
        latitude: 10.77,
        longitude: 106.7,
        location: { formatted_address: "Quận 1" },
      },
    ],
    [
      "geoapify",
      "GEOAPIFY_API_KEY",
      {
        features: [
          { properties: { place_id: "place_1", name: "Quán thật", lat: 10.77, lon: 106.7 } },
        ],
      },
    ],
  ] as const)(
    "normalizes %s without exposing credentials or inventing dish media",
    async (source, key, payload) => {
      const fetcher = vi.fn().mockResolvedValue(response(payload));
      const detail = await createRestaurantProviders({ [key]: "private-secret" }, fetcher).detail(
        source,
        "place_1",
      );
      expect(detail.name).toBe("Quán thật");
      expect(detail.mediaKind).toBe("VENUE");
      expect(JSON.stringify(detail)).not.toContain("private-secret");
      if (source === "google") {
        expect(detail.photo?.authors[0]?.name).toBe("Tác giả");
        expect(detail.rating).toBe(4.4);
        expect(detail.attributions[0]?.provider).toBe("Google Maps");
      } else {
        expect(detail.rating).toBeNull();
        expect(detail.photo).toBeNull();
      }
      if (source === "geoapify")
        expect(detail.attributions.some((item) => item.provider.includes("OpenStreetMap"))).toBe(
          true,
        );
    },
  );
  it("fails closed on missing credentials, incorrect provider IDs, quota and malicious links", async () => {
    const fetcher = vi.fn();
    await expect(
      createRestaurantProviders({}, fetcher).detail("google", "place_1"),
    ).rejects.toMatchObject({ code: "PLACES_NOT_CONFIGURED" });
    expect(fetcher).not.toHaveBeenCalled();
    const payload = {
      id: "other",
      displayName: { text: "Wrong" },
      location: { latitude: 10, longitude: 106 },
    };
    fetcher.mockResolvedValueOnce(response(payload));
    await expect(
      createRestaurantProviders({ GOOGLE_PLACES_API_KEY: "key" }, fetcher).detail(
        "google",
        "place_1",
      ),
    ).rejects.toMatchObject({ code: "PLACES_UNAVAILABLE" });
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(
      createRestaurantProviders({ GOOGLE_PLACES_API_KEY: "key" }, fetcher).detail(
        "google",
        "place_1",
      ),
    ).rejects.toMatchObject({ code: "PLACES_QUOTA_EXCEEDED" });
    fetcher.mockResolvedValueOnce(
      response({
        ...payload,
        id: "place_1",
        websiteUri: "https://example.org/?apiKey=secret",
        googleMapsUri: "javascript:alert(1)",
        photos: [{ name: "places/place_1/photos/p?key=secret" }],
      }),
    );
    const detail = await createRestaurantProviders(
      { GOOGLE_PLACES_API_KEY: "key" },
      fetcher,
    ).detail("google", "place_1");
    expect(detail.websiteUrl).toBeNull();
    expect(detail.photo).toBeNull();
    expect(detail.mapsUrl).toContain("https://www.google.com/maps/search/");
  });
});
