import {
  object,
  list,
  string,
  number,
  safeUrl,
  providerJson,
  ProviderError,
} from "./provider.http.js";
export const recipeSources = ["themealdb", "spoonacular"] as const;
export type RecipeSource = (typeof recipeSources)[number];
export type Recipe = {
  id: string;
  source: RecipeSource;
  title: string;
  image: string | null;
  sourceUrl: string | null;
  videoUrl: string | null;
  cuisine: string | null;
  readyInMinutes: number | null;
  servings: number | null;
  ingredients: string[];
  steps: string[];
  language: "SOURCE_ORIGINAL";
};
const plainText = (value: unknown) =>
  string(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
export function mealRecipe(value: unknown): Recipe | null {
  const m = object(value);
  if (!/^\d+$/.test(string(m.idMeal)) || !string(m.strMeal).trim()) return null;
  return {
    id: string(m.idMeal),
    source: "themealdb",
    title: string(m.strMeal).slice(0, 200),
    image: safeUrl(m.strMealThumb),
    sourceUrl: safeUrl(m.strSource),
    videoUrl: safeUrl(m.strYoutube),
    cuisine: string(m.strArea) || null,
    readyInMinutes: null,
    servings: null,
    ingredients: Array.from({ length: 20 }, (_, i) =>
      `${string(m[`strMeasure${i + 1}`]).trim()} ${string(m[`strIngredient${i + 1}`]).trim()}`.trim(),
    )
      .filter((_, i) => string(m[`strIngredient${i + 1}`]).trim())
      .map((v) => v.slice(0, 500)),
    steps: string(m.strInstructions)
      .split(/\r?\n+/)
      .map(plainText)
      .filter(Boolean)
      .slice(0, 100),
    language: "SOURCE_ORIGINAL",
  };
}
export function spoonRecipe(value: unknown): Recipe | null {
  const m = object(value);
  if (!Number.isSafeInteger(m.id) || Number(m.id) <= 0 || !string(m.title).trim()) return null;
  const steps = list(m.analyzedInstructions)
    .flatMap((v) => list(object(v).steps))
    .map((v) => plainText(object(v).step))
    .filter(Boolean);
  return {
    id: String(m.id),
    source: "spoonacular",
    title: string(m.title).slice(0, 200),
    image: safeUrl(m.image),
    sourceUrl: safeUrl(m.sourceUrl),
    videoUrl: null,
    cuisine: list(m.cuisines).map(string).filter(Boolean).join(", ") || null,
    readyInMinutes: number(m.readyInMinutes),
    servings: number(m.servings),
    ingredients: list(m.extendedIngredients)
      .map((v) => plainText(object(v).original))
      .filter(Boolean)
      .slice(0, 100),
    steps: (steps.length ? steps : [plainText(m.instructions)].filter(Boolean)).slice(0, 100),
    language: "SOURCE_ORIGINAL",
  };
}
export function createRecipeProviders(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
) {
  const key = (source: RecipeSource) =>
    (source === "themealdb" ? env.THEMEALDB_API_KEY : env.SPOONACULAR_API_KEY)?.trim();
  return {
    configured: (source: RecipeSource) => !!key(source),
    async search(source: RecipeSource, query: string, day?: number): Promise<Recipe[]> {
      if (!key(source)) return [];
      if (source === "themealdb") {
        const url = new URL(
          `https://www.themealdb.com/api/json/v1/${encodeURIComponent(key(source)!)}/search.php`,
        );
        const letters = "abcdefghijklmnoprst";
        url.searchParams.set(query ? "s" : "f", query || letters[(day ?? 0) % letters.length]!);
        const data = await providerJson(source, url.href, {}, fetcher);
        if (data.meals !== null && !Array.isArray(data.meals))
          throw new ProviderError("INVALID_DATA");
        return list(data.meals)
          .map(mealRecipe)
          .filter((r): r is Recipe => !!r)
          .slice(0, 20);
      }
      const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
      if (query) url.searchParams.set("query", query);
      url.searchParams.set("number", "12");
      url.searchParams.set("addRecipeInformation", "true");
      url.searchParams.set("fillIngredients", "true");
      url.searchParams.set("sort", "popularity");
      if (!query) url.searchParams.set("offset", String(((day ?? 0) % 7) * 12));
      const data = await providerJson(
        source,
        url.href,
        { headers: { "x-api-key": key(source)! } },
        fetcher,
      );
      if (!Array.isArray(data.results)) throw new ProviderError("INVALID_DATA");
      return data.results
        .map(spoonRecipe)
        .filter((r): r is Recipe => !!r)
        .slice(0, 20);
    },
    async detail(source: RecipeSource, id: string): Promise<Recipe | null> {
      if (!key(source)) return null;
      if (source === "themealdb") {
        const url = new URL(
          `https://www.themealdb.com/api/json/v1/${encodeURIComponent(key(source)!)}/lookup.php`,
        );
        url.searchParams.set("i", id);
        const data = await providerJson(source, url.href, {}, fetcher);
        if (data.meals !== null && !Array.isArray(data.meals))
          throw new ProviderError("INVALID_DATA");
        return mealRecipe(list(data.meals)[0]);
      }
      return spoonRecipe(
        await providerJson(
          source,
          `https://api.spoonacular.com/recipes/${encodeURIComponent(id)}/information?includeNutrition=false`,
          { headers: { "x-api-key": key(source)! } },
          fetcher,
        ),
      );
    },
  };
}
