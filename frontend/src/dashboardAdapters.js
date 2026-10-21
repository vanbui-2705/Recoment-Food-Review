import { resolveDishImage } from "./menuData.js";

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
    image:
      item.photo || item.imageUrl || item.image
        ? resolveDishImage(item, item.id || item.dishId || title)
        : null,
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
    image: resolveDishImage(item, item.dishId || item.placeId || item.id || name),
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

export function hasTasteSignals(text) {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return /cay|ngọt|chua|mặn|thanh đạm|đậm đà|dị ứng|tôm|cua|mực|ốc|hải sản|lạc|đậu phộng|sữa|lactose|gluten|ngân sách|bình dân|tiết kiệm|dưới \d+k|\d+k|thích ăn|không thích|ngán/i.test(
    lower,
  );
}

export function analyzeTasteLocally(text) {
  const lower = (text || "").toLowerCase();

  // 1. Spicy level (0-100)
  let spicy = 30;
  if (/không (ăn|thích) cay|không cay|sợ cay/i.test(lower)) spicy = 0;
  else if (/cay nhẹ|ít cay|the the|hơi cay/i.test(lower)) spicy = 25;
  else if (/cay vừa|cay trung bình/i.test(lower)) spicy = 50;
  else if (/thích cay|ăn được cay|cay nồng/i.test(lower)) spicy = 70;
  else if (/siêu cay|rất cay|cực cay/i.test(lower)) spicy = 90;

  // 2. Sweet level (0-100)
  let sweet = 45;
  if (/không (ăn|thích) ngọt|ít ngọt|không đường|ít đường/i.test(lower)) sweet = 15;
  else if (/ngọt thanh|ngọt dịu|vừa ngọt/i.test(lower)) sweet = 40;
  else if (/thích ngọt|ngọt miền nam|hảo ngọt/i.test(lower)) sweet = 80;

  // 3. Sour level (0-100)
  let sour = 30;
  if (/không (ăn|thích) chua|sợ chua/i.test(lower)) sour = 5;
  else if (/chua thanh|canh chua|chua nhẹ/i.test(lower)) sour = 50;
  else if (/thích chua|chua cay|rất chua/i.test(lower)) sour = 75;

  // 4. Salty / Bold flavor (0-100)
  let salty = 40;
  if (/thanh đạm|nhạt|ít muối|ít dầu/i.test(lower)) salty = 25;
  else if (/vừa miệng|hài hòa/i.test(lower)) salty = 45;
  else if (/đậm đà|đậm vị|mặn mà/i.test(lower)) salty = 70;

  // 5. Budget min & max
  let budgetMin = 30000;
  let budgetMax = 70000;
  const budgetMatch = lower.match(/(\d{1,3})(?:k|\.000|\s?nghìn|\s?ngàn)/);
  if (budgetMatch) {
    const num = parseInt(budgetMatch[1], 10) * 1000;
    if (num >= 20000 && num <= 500000) {
      budgetMax = num;
      budgetMin = Math.max(0, num - 40000);
    }
  }

  // 6. Distance
  let distance = 3500;
  const distMatch = lower.match(/(\d(?:\.\d)?)\s?(?:km|cây)/);
  if (distMatch) {
    distance = Math.round(parseFloat(distMatch[1]) * 1000);
  }

  // 7. Allergies
  const detectedAllergies = {
    seafood: /tôm|cua|mực|ốc|hải sản/i.test(lower),
    peanuts: /đậu phộng|lạc|bơ đậu phộng/i.test(lower),
    dairy: /sữa|phô mai|lactose|bơ sữa/i.test(lower),
    gluten: /bột mì|gluten/i.test(lower),
  };

  // 8. Tags & Cuisine preferences
  const tags = [];
  if (/thanh đạm|ít dầu/i.test(lower)) tags.push("Thanh đạm");
  if (/đậm đà/i.test(lower)) tags.push("Đậm đà");
  if (/miền nam/i.test(lower)) tags.push("Vị miền Nam");
  if (/miền bắc|phở/i.test(lower)) tags.push("Vị miền Bắc");
  if (/miền trung|bún bò/i.test(lower)) tags.push("Vị miền Trung");
  if (/hàn|korean/i.test(lower)) tags.push("Ẩm thực Hàn");
  if (/nhật|japanese|sushi/i.test(lower)) tags.push("Ẩm thực Nhật");
  if (/healthy|eat clean|rau/i.test(lower)) tags.push("Healthy / Eat Clean");

  return {
    spicyLevel: spicy,
    sweetLevel: sweet,
    sourLevel: sour,
    saltyLevel: salty,
    budgetMin,
    budgetMax,
    maxDistanceMeters: distance,
    allergies: detectedAllergies,
    tags,
  };
}
