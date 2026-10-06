import { describe, expect, it, vi } from "vitest";
import { createPlacesAdapter } from "../../src/modules/places/places.adapter.js";
const location = { latitude: 10, longitude: 106 };
describe("Google Places adapter", () => {
  it("requires configuration without making a network request", async () => {
    const fetcher = vi.fn();
    await expect(
      createPlacesAdapter("", fetcher).search("Pho", location, 3000),
    ).rejects.toMatchObject({ statusCode: 503, code: "PLACES_NOT_CONFIGURED" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("bounds requests, filters distance/closed businesses and never invents menu or price", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "near",
              displayName: { text: "Pho" },
              location,
              businessStatus: "OPERATIONAL",
              attributions: [{ provider: "Provider" }],
            },
            {
              id: "far",
              displayName: { text: "Far" },
              location: { latitude: 12, longitude: 106 },
              businessStatus: "OPERATIONAL",
            },
            {
              id: "closed",
              displayName: { text: "Closed" },
              location,
              businessStatus: "PERMANENTLY_CLOSED",
            },
          ],
        }),
      ),
    );
    const items = await createPlacesAdapter("secret", fetcher).search("Pho", location, 3000);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      placeId: "near",
      menuConfirmed: false,
      price: null,
      openNow: null,
      rating: null,
    });
    expect(items[0]?.attributions).toEqual([{ provider: "Provider" }]);
    const options = fetcher.mock.calls[0]![1];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.headers["X-Goog-FieldMask"]).not.toContain("*");
    expect(JSON.parse(options.body).locationBias.circle.radius).toBe(3000);
  });
  it("sanitizes timeout, rate-limit and malformed responses", async () => {
    for (const [fetcher, code] of [
      [vi.fn().mockRejectedValue(new Error("secret")), "PLACES_UNAVAILABLE"],
      [vi.fn().mockResolvedValue(new Response("secret", { status: 429 })), "PLACES_QUOTA_EXCEEDED"],
      [vi.fn().mockResolvedValue(new Response("not-json")), "PLACES_UNAVAILABLE"],
    ] as const) {
      await expect(
        createPlacesAdapter("secret", fetcher).search("Pho", location, 3000),
      ).rejects.toMatchObject({ code });
    }
  });
});
