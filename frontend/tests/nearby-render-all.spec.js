import { expect, test } from "@playwright/test";

test("discovery renders every nearby restaurant returned by the backend", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "render-all-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "User", email: "user@example.com" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            areaLabel: "Hà Nội",
            latitude: 21.03,
            longitude: 105.79,
            budgetMax: 70000,
            maxDistanceMeters: 3500,
            allergies: [],
          },
        },
      },
    }),
  );
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({ json: { data: { status: "SUCCESS", items: [] } } }),
  );
    await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({ json: { data: { status: "SUCCESS", items: [] } } }),
  );
  await page.route("**/api/discovery/nearby-food?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [],
          restaurants: Array.from({ length: 12 }, (_, index) => ({
            placeId: `place-${index + 1}`,
            source: "geoapify",
            name: `Quán thật ${index + 1}`,
            address: `Địa chỉ ${index + 1}`,
            distanceMeters: 100 + index,
            latitude: 21.03 + index / 10000,
            longitude: 105.79 + index / 10000,
          })),
        },
      },
    }),
  );

  await page.goto("/#today");

  await expect(page.getByText("Quán thật 12", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Quán thật \d+$/)).toHaveCount(12);
});
