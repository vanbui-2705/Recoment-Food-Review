import { expect, test } from "@playwright/test";
import {
  allergiesFromProfile,
  chatMessageToView,
  historyInteractionToOrder,
  historyInteractionToView,
  mergeAllergiesIntoProfile,
  mealPeriodForLocalHour,
  nearbyToPlace,
  priceTierForRange,
  recommendationToCard,
  todayPayloadToCards,
} from "../src/dashboardAdapters.js";

test("local hour maps deterministically to breakfast, lunch and dinner", () => {
  expect(mealPeriodForLocalHour(5)).toBe("BREAKFAST");
  expect(mealPeriodForLocalHour(10)).toBe("BREAKFAST");
  expect(mealPeriodForLocalHour(11)).toBe("LUNCH");
  expect(mealPeriodForLocalHour(15)).toBe("LUNCH");
  expect(mealPeriodForLocalHour(16)).toBe("DINNER");
  expect(mealPeriodForLocalHour(2)).toBe("DINNER");
});

test("price ranges map to honest browsing tiers", () => {
  expect(priceTierForRange(60000)?.label).toBe("Bình dân");
  expect(priceTierForRange(150000)?.label).toBe("Hằng ngày");
  expect(priceTierForRange(350000)?.label).toBe("Cao cấp");
  expect(priceTierForRange(350001)?.label).toBe("Dịp đặc biệt");
  expect(priceTierForRange(null)).toBeNull();
});

test("profile adapter maps managed allergens and preserves unknown codes", () => {
  const profile = {
    allergies: [
      { code: "SHELLFISH", severity: "MODERATE", notes: "source" },
      { code: "SESAME", severity: "MILD", notes: null },
    ],
  };
  expect(allergiesFromProfile(profile)).toEqual({
    seafood: true,
    peanuts: false,
    dairy: false,
    gluten: false,
  });
  expect(
    mergeAllergiesIntoProfile(profile, {
      seafood: false,
      peanuts: true,
      dairy: false,
      gluten: false,
    }),
  ).toEqual([
    { code: "SESAME", severity: "MILD", notes: null },
    { code: "PEANUT", severity: "SEVERE", notes: null },
  ]);
});

test("recommendation adapter keeps nullable evidence honest", () => {
  expect(
    recommendationToCard({
      id: "result-1",
      dishId: "dish-1",
      title: "A".repeat(150),
      restaurantName: "Restaurant",
      price: null,
      distanceMeters: 250,
      photo: null,
      rating: null,
      warnings: ["OPENING_UNCONFIRMED"],
    }),
  ).toMatchObject({
    id: "result-1",
    dishId: "dish-1",
    price: null,
    distanceMeters: 250,
    image: null,
    rating: null,
    warnings: ["OPENING_UNCONFIRMED"],
  });
  expect(recommendationToCard({ title: "Missing dish id" })).toBeNull();
});

test("nearby adapter accepts dishes and restaurants without inventing fields", () => {
  expect(
    nearbyToPlace({
      dishId: "dish-1",
      title: "Phở bò",
      restaurantName: "Quán phở",
      distanceMeters: 500,
      price: 45000,
    }),
  ).toMatchObject({
    id: "dish-1",
    dishId: "dish-1",
    name: "Quán phở",
    dish: "Phở bò",
    distanceMeters: 500,
    price: 45000,
    openNow: null,
  });
  expect(
    nearbyToPlace({ placeId: "place-1", name: "Nearby", rating: null }),
  ).toMatchObject({ id: "place-1", dishId: null, rating: null, price: null });
});

test("chat adapter accepts only backend conversation roles", () => {
  expect(
    chatMessageToView({ id: "message-1", role: "USER", content: "Hello" }),
  ).toEqual({
    id: "message-1",
    role: "USER",
    text: "Hello",
    createdAt: null,
  });
  expect(chatMessageToView({ id: "message-2", role: "SYSTEM" })).toBeNull();
});

test("interaction history is never reinterpreted as an order", () => {
  expect(
    historyInteractionToOrder({
      id: "interaction-1",
      kind: "DISH",
      interactionType: "CHOSEN",
    }),
  ).toBeNull();
});

test("interaction history maps only chosen and eaten records", () => {
  expect(
    historyInteractionToView({
      id: "interaction-1",
      kind: "DISH",
      title: "Bún chả",
      interactionType: "CHOSEN",
      createdAt: "2026-10-12T01:00:00.000Z",
      appRating: 5,
    }),
  ).toMatchObject({
    id: "interaction-1",
    kind: "DISH",
    title: "Bún chả",
    interactionType: "CHOSEN",
    appRating: 5,
  });
  expect(
    historyInteractionToView({
      id: "feedback-1",
      kind: "DISH",
      title: "Bún chả",
      interactionType: "LIKED",
    }),
  ).toBeNull();
});

test("today adapter accepts real dish and recipe payloads without inventing values", () => {
  const cards = todayPayloadToCards(
    {
      items: [
        {
          id: "dish-1",
          name: "A".repeat(200),
          priceMin: 45000,
          priceMax: 65000,
          imageUrl: "/images/dishes/catalog.jpg",
          imageAttribution: "Open image",
          score: 91.5,
          mealPeriods: ["LUNCH"],
        },
      ],
    },
    {
      items: [
        {
          id: "12",
          source: "themealdb",
          title: "Recipe",
          image: null,
        },
      ],
    },
  );
  expect(cards).toHaveLength(2);
  expect(cards[0]).toMatchObject({
    dishId: "dish-1",
    price: 45000,
    priceMax: 65000,
    score: 91.5,
    kind: "DISH",
    image: "/images/dishes/catalog.jpg",
    imageAttribution: "Open image",
    priceTier: { id: "EVERYDAY", label: "Hằng ngày" },
    mealPeriods: ["LUNCH"],
  });
  expect(cards[1]).toMatchObject({
    id: "themealdb:12",
    recipeId: "12",
    source: "themealdb",
    image: null,
    price: null,
    kind: "RECIPE",
  });
});
