import { expect, test } from "@playwright/test";

const initialItems = [
  {
    id: "pho",
    name: "Phở bò",
    imageUrl: "/images/dishes/pho-bo.jpg",
    priceMin: 40_000,
    priceMax: 90_000,
    score: 96,
    reason: "Phù hợp khẩu vị và khoảng giá tham khảo",
  },
  {
    id: "bun-cha",
    name: "Bún chả",
    imageUrl: "/images/dishes/bun-cha.jpg",
    priceMin: 45_000,
    priceMax: 90_000,
    score: 90,
  },
];

const learnedItems = [
  {
    ...initialItems[1],
    score: 98,
    behaviorAdjustment: 12.5,
    learnedReason: "Bạn thường phản hồi tích cực với các món cùng nền ẩm thực",
    reason:
      "Bạn thường phản hồi tích cực với các món cùng nền ẩm thực. Món vẫn đáp ứng khẩu vị và khoảng giá hiện tại.",
  },
];

test("records a dwell once, learns from not-for-me, and renders refreshed ordering", async ({
  page,
}, testInfo) => {
  const interactions = [];
  const preferences = [];
  let recommendationReads = 0;
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "behavior-learning-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "Behavior User" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            areaLabel: "TP. Hồ Chí Minh",
            latitude: 10.77,
            longitude: 106.7,
            budgetMax: 500_000,
            maxDistanceMeters: 3500,
            allergies: [],
          },
        },
      },
    }),
  );
  await page.route("**/api/recommendations/today?*", (route) => {
    recommendationReads += 1;
    const learned = recommendationReads > 1;
    return route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: learned ? learnedItems : initialItems,
          learning: learned
            ? {
                sampleSize: 3,
                confidence: "LEARNING",
                topCuisines: [{ code: "VIETNAMESE", name: "Việt Nam" }],
                privateToUser: true,
              }
            : {
                sampleSize: 0,
                confidence: "COLD_START",
                topCuisines: [],
                privateToUser: true,
              },
        },
      },
    });
  });
  await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({ json: { data: { status: "SUCCESS", items: [] } } }),
  );
  await page.route("**/api/users/me/dishes/*/interactions", (route) => {
    interactions.push(route.request().postDataJSON());
    return route.fulfill({ json: { data: { id: `event-${interactions.length}` } } });
  });
  await page.route("**/api/users/me/dishes/*/preference", (route) => {
    preferences.push(route.request().postDataJSON());
    return route.fulfill({ json: { data: { preference: route.request().postDataJSON().preference } } });
  });

  await page.goto("/#today");
  await expect(page.getByRole("heading", { name: "Phở bò", exact: true })).toBeVisible();
  await expect(page.getByText("Hãy phản hồi để EatWise học gu", { exact: true })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.mouse.move(200, 700);
    await page.mouse.wheel(0, 520);
  }
  await expect.poll(() => interactions.filter((item) => item.type === "VIEWED").length, {
    timeout: 7000,
  }).toBe(1);

  await page.getByRole("button", { name: "Không hợp gu: Phở bò" }).click();
  await expect(page.getByRole("heading", { name: "Bún chả", exact: true })).toBeVisible();
  await expect(page.getByText("EatWise đang học gu của bạn", { exact: true })).toBeVisible();
  await expect(page.getByText("Thường thích Việt Nam", { exact: true })).toBeVisible();
  await expect(page.getByText(/Bạn thường phản hồi tích cực với các món cùng nền ẩm thực/)).toBeVisible();
  expect(interactions.filter((item) => item.type === "VIEWED")).toHaveLength(1);
  expect(interactions.some((item) => item.type === "SKIPPED")).toBe(true);
  expect(preferences).toContainEqual({ preference: "DISLIKED" });
  expect(recommendationReads).toBeGreaterThanOrEqual(2);
});
