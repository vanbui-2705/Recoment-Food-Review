const finiteOrNull = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const mealPeriodForLocalHour = (hour = new Date().getHours()) => {
  if (hour >= 5 && hour < 11) return "BREAKFAST";
  if (hour >= 11 && hour < 16) return "LUNCH";
  return "DINNER";
};

export const priceTierForRange = (priceMax) => {
  if (typeof priceMax !== "number" || !Number.isFinite(priceMax)) return null;
  if (priceMax <= 60000) return { id: "AFFORDABLE", label: "Bình dân" };
  if (priceMax <= 150000) return { id: "EVERYDAY", label: "Hằng ngày" };
  if (priceMax <= 350000) return { id: "PREMIUM", label: "Cao cấp" };
  return { id: "SPECIAL", label: "Dịp đặc biệt" };
};

export const ALLERGY_UI_CODES = Object.freeze({
  seafood: "SHELLFISH",
  peanuts: "PEANUT",
  dairy: "MILK",
  gluten: "WHEAT_GLUTEN",
});

export function allergiesFromProfile(profile) {
  const selected = new Set(
    Array.isArray(profile?.allergies)
      ? profile.allergies.map((item) => item?.code).filter(Boolean)
      : [],
  );
  return Object.fromEntries(
    Object.entries(ALLERGY_UI_CODES).map(([uiKey, code]) => [
      uiKey,
      selected.has(code),
    ]),
  );
}

export function mergeAllergiesIntoProfile(profile, selected) {
  const managedCodes = new Set(Object.values(ALLERGY_UI_CODES));
  const preserved = Array.isArray(profile?.allergies)
    ? profile.allergies
        .filter((item) => item?.code && !managedCodes.has(item.code))
        .map((item) => ({
          code: item.code,
          severity: item.severity || "SEVERE",
          notes: item.notes ?? null,
        }))
    : [];
  const managed = Object.entries(ALLERGY_UI_CODES)
    .filter(([uiKey]) => Boolean(selected?.[uiKey]))
    .map(([, code]) => ({ code, severity: "SEVERE", notes: null }));
  return [...preserved, ...managed];
}

export function recommendationToCard(item) {
  const isRecipe = Boolean(item?.source && item?.id && item?.title);
  const dishId = item?.dishId || (!isRecipe ? item?.id : null);
  const title = item?.title || item?.name;
  if ((!dishId && !isRecipe) || !title) return null;
  const priceMin = finiteOrNull(item?.priceMin);
  const priceMax = finiteOrNull(item?.priceMax);
  const priceTier = priceTierForRange(priceMax ?? priceMin);
  return {
    id: isRecipe ? `${item.source}:${item.id}` : item.id ?? dishId,
    dishId,
    recipeId: isRecipe ? item.id : null,
    source: isRecipe ? item.source : null,
    kind: isRecipe ? "RECIPE" : "DISH",
    title,
    restaurantName: item.restaurantName || "",
    price: finiteOrNull(item.price) ?? priceMin,
    priceMax,
    distanceMeters: finiteOrNull(item.distanceMeters),
    rating: finiteOrNull(item.rating),
    ratingCount: finiteOrNull(item.ratingCount),
    score: finiteOrNull(item.score),
    image: item.photo || item.imageUrl || item.image || null,
    imageAttribution: item.imageAttribution || null,
    priceTier,
    reason: item.reason || "",
    learnedReason: item.learnedReason || null,
    behaviorAdjustment: finiteOrNull(item.behaviorAdjustment),
    warnings: Array.isArray(item.warnings)
      ? item.warnings
      : item.safetyWarning
        ? [item.safetyWarning]
        : [],
    mealPeriods: Array.isArray(item.mealPeriods) ? item.mealPeriods : [],
  };
}

export function todayPayloadToCards(recommendations, recipes) {
  const recommendationItems = Array.isArray(recommendations?.items)
    ? recommendations.items
    : [];
  const recipeItems = Array.isArray(recipes?.items) ? recipes.items : [];
  return [...recommendationItems, ...recipeItems]
    .map(recommendationToCard)
    .filter(Boolean);
}

export function nearbyToPlace(item) {
  const id = item?.dishId || item?.placeId || item?.id;
  const name = item?.restaurantName || item?.name || item?.title;
  if (!id || !name) return null;
  return {
    id,
    dishId: item.dishId || null,
    name,
    dish: item.title || null,
    address: item.address || "",
    latitude: finiteOrNull(item.latitude),
    longitude: finiteOrNull(item.longitude),
    distanceMeters: finiteOrNull(item.distanceMeters),
    rating: finiteOrNull(item.rating),
    ratingCount: finiteOrNull(item.ratingCount),
    price: finiteOrNull(item.price),
    image: item.photo || null,
    openNow: typeof item.openNow === "boolean" ? item.openNow : null,
    mapsUrl: item.mapsUrl || null,
  };
}

export function chatMessageToView(message) {
  if (!message?.id || !["USER", "ASSISTANT"].includes(message.role)) return null;
  return {
    id: message.id,
    role: message.role,
    text: typeof message.content === "string" ? message.content : "",
    createdAt: message.createdAt || null,
  };
}

export function historyInteractionToOrder() {
  // Interaction history has no order, payment, courier, or delivery semantics.
  return null;
}

export function historyInteractionToView(item) {
  if (
    !item?.id ||
    !["DISH", "RECIPE"].includes(item.kind) ||
    !["CHOSEN", "EATEN"].includes(item.interactionType) ||
    !item.title
  ) {
    return null;
  }
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    interactionType: item.interactionType,
    createdAt: item.createdAt || null,
    appRating:
      Number.isInteger(item.appRating) && item.appRating >= 1 && item.appRating <= 5
        ? item.appRating
        : null,
    source: item.kind === "RECIPE" ? item.source || null : null,
    recipeId: item.kind === "RECIPE" ? item.recipeId || null : null,
    eligibleAgainAt: item.eligibleAgainAt || null,
  };
}
