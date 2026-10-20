import { expect, test } from "@playwright/test";

test("renders the dish catalog when personalized recommendations require onboarding", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "onboarding-fallback-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "New Food User" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({ json: { data: { profile: null } } }),
  );
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "ONBOARDING_REQUIRED",
          items: [],
          discoveryContext: { personalizedReady: false, budget: 50000 },
        },
      },
    }),
  );
  await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );
  await page.route("**/api/dishes?*", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id: "starter-banh-mi",
              name: "Bánh mì khởi đầu",
              imageUrl: "/images/dishes/banh-mi-thit.jpg",
              priceMin: 20000,
              priceMax: 50000,
              mealPeriods: ["BREAKFAST", "LUNCH", "DINNER"],
            },
            {
              id: "starter-pho",
              name: "Phở bò khởi đầu",
              imageUrl: "/images/dishes/pho-bo.jpg",
              priceMin: 40000,
              priceMax: 90000,
              mealPeriods: ["BREAKFAST", "LUNCH", "DINNER"],
            },
          ],
        },
      },
    }),
  );

  await page.goto("/#today");

  await expect(page.getByRole("heading", { name: "Bánh mì khởi đầu" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Bánh mì khởi đầu" })).toBeVisible();
  await expect(page.getByText("Phở bò khởi đầu", { exact: true })).toBeVisible();
  await expect(page.getByText("Danh mục món khởi đầu", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hoàn thiện hồ sơ vị giác" })).toBeVisible();
});
