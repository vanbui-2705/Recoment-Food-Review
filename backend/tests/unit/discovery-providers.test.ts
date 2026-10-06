import { describe, expect, it, vi } from "vitest";
import {
  createRecipeProviders,
  mealRecipe,
  spoonRecipe,
} from "../../src/modules/discovery/recipe.providers.js";
import { createPlaceProviders } from "../../src/modules/discovery/place.providers.js";
import { collectSources, dedupeRecipes } from "../../src/modules/discovery/discovery.service.js";
import { providerJson, ProviderError } from "../../src/modules/discovery/provider.http.js";
const json = (value: unknown) => new Response(JSON.stringify(value));
const meal = {
  idMeal: "12",
  strMeal: "Phở bò",
  strIngredient1: "Beef",
  strMeasure1: "200 g",
  strInstructions: "Prepare\r\nCook",
  strYoutube: "javascript:alert(1)",
  strSource: "https://example.com/pho",
};
const origin = { latitude: 10.77, longitude: 106.7 };
describe("external discovery contracts", () => {
  it("skips unconfigured providers without network calls", async () => {
    const fetcher = vi.fn();
    const providers = createRecipeProviders({}, fetcher);
    expect(providers.configured("themealdb")).toBe(false);
    expect(await providers.search("themealdb", "pho")).toEqual([]);
    const result = await collectSources(["themealdb"], () => false, fetcher);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("normalizes ingredients, instructions and blocks unsafe source links", () => {
    const parsed = mealRecipe(meal)!;
    expect(parsed.ingredients).toEqual(["200 g Beef"]);
    expect(parsed.steps).toEqual(["Prepare", "Cook"]);
    expect(parsed.videoUrl).toBeNull();
    expect(mealRecipe({ idMeal: "invalid", strMeal: "Pho" })).toBeNull();
    const spoon = spoonRecipe({
      id: 12,
      title: "Recipe",
      analyzedInstructions: [{ steps: [{ step: "<b>Boil</b> water" }] }],
      extendedIngredients: [{ original: "1 cup water" }],
    });
    expect(spoon?.steps).toEqual(["Boil water"]);
    expect(
      dedupeRecipes([parsed, { ...parsed, source: "spoonacular", title: "Beef pho" }]),
    ).toHaveLength(1);
  });
  it("uses documented recipe endpoints and carries credentials only on backend requests", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ meals: [meal] }))
      .mockResolvedValueOnce(json({ results: [{ id: 13, title: "Beef soup" }] }));
    const providers = createRecipeProviders(
      { THEMEALDB_API_KEY: "test", SPOONACULAR_API_KEY: "secret" },
      fetcher,
    );
    expect((await providers.search("themealdb", "phở bò"))[0]?.title).toBe("Phở bò");
    expect((await providers.search("spoonacular", "soup"))[0]?.source).toBe("spoonacular");
    expect(new URL(fetcher.mock.calls[0]![0]).searchParams.get("s")).toBe("phở bò");
    expect(fetcher.mock.calls[1]![1].headers["x-api-key"]).toBe("secret");
    expect(fetcher.mock.calls[1]![0]).not.toContain("secret");
  });
  it("isolates a quota failure and retains results from other sources", async () => {
    const result = await collectSources(
      ["good", "bad", "missing"],
      (s) => s !== "missing",
      async (s) => {
        if (s === "bad") throw new ProviderError("QUOTA_EXCEEDED");
        return [{ name: "Pho" }];
      },
    );
    expect(result.items).toHaveLength(1);
    expect(result.sources).toContainEqual({ source: "bad", status: "QUOTA_EXCEEDED" });
    expect(result.status).toBe("SUCCESS");
  });
  it("bounds payloads, refuses redirects and distinguishes quota responses", async () => {
    await expect(
      providerJson(
        "test-quota",
        "https://example.com",
        {},
        vi.fn().mockResolvedValue(new Response("", { status: 429 })),
      ),
    ).rejects.toMatchObject({ status: "QUOTA_EXCEEDED" });
    await expect(
      providerJson(
        "test-large",
        "https://example.com",
        {},
        vi.fn().mockResolvedValue(new Response("x".repeat(3_000_001))),
      ),
    ).rejects.toMatchObject({ status: "INVALID_DATA" });
    const fetcher = vi.fn().mockResolvedValue(json({ ok: true }));
    await providerJson("test-redirect", "https://example.com", {}, fetcher);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ redirect: "error" });
  });
  it("uses current Foursquare schema and filters outside radius/closed places", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        results: [
          {
            fsq_place_id: "near",
            name: "Pho",
            latitude: 10.77,
            longitude: 106.7,
            location: { formatted_address: "Test" },
          },
          { fsq_place_id: "far", name: "Pho", latitude: 20, longitude: 106 },
          {
            fsq_place_id: "closed",
            name: "Pho",
            latitude: 10.77,
            longitude: 106.7,
            date_closed: "2026-01-01",
          },
        ],
      }),
    );
    const result = await createPlaceProviders({ FOURSQUARE_API_KEY: "secret" }, fetcher).search(
      "foursquare",
      "pho",
      origin,
      3000,
    );
    expect(result.map((r) => r.placeId)).toEqual(["near"]);
    expect(result[0]).toMatchObject({ menuConfirmed: false, price: null, rating: null });
    expect(fetcher.mock.calls[0]![0]).toContain("places-api.foursquare.com");
    expect(fetcher.mock.calls[0]![1].headers.Authorization).toBe("Bearer secret");
  });
  it("marks Geoapify results as nearby restaurants rather than matching menu items", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        features: [
          { properties: { place_id: "near", name: "Restaurant", lat: 10.77, lon: 106.7 } },
        ],
      }),
    );
    const result = await createPlaceProviders({ GEOAPIFY_API_KEY: "secret" }, fetcher).search(
      "geoapify",
      "pho",
      origin,
      3000,
    );
    expect(result[0]?.matchType).toBe("NEARBY_RESTAURANT");
    expect(result[0]?.attributions).toHaveLength(2);
    expect(new URL(fetcher.mock.calls[0]![0]).searchParams.get("categories")).toBe(
      "catering.restaurant",
    );
  });
  it("resolves Goong predictions through details and bounds detail fanout", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          status: "OK",
          predictions: Array.from({ length: 10 }, (_, i) => ({ place_id: String(i) })),
        }),
      )
      .mockImplementation(async () =>
        json({
          status: "OK",
          result: {
            place_id: "near",
            name: "Pho",
            geometry: { location: { lat: 10.77, lng: 106.7 } },
          },
        }),
      );
    const result = await createPlaceProviders({ GOONG_API_KEY: "secret" }, fetcher).search(
      "goong",
      "pho",
      origin,
      3000,
    );
    expect(result).toHaveLength(5);
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(new URL(fetcher.mock.calls[0]![0]).searchParams.get("radius")).toBe("3");
  });
});
