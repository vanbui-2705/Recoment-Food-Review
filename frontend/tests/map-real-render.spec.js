import { expect, test } from "@playwright/test";

test("map renders an interactive map when nearby API returns coordinates", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "map-render-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "Map User", email: "map@example.com" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            areaLabel: "Cầu Giấy",
            latitude: 21.03,
            longitude: 105.79,
            maxDistanceMeters: 3500,
            allergies: [],
          },
        },
      },
    }),
  );
  await page.route("**/api/discovery/nearby-food?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [
            {
              id: "place-1",
              name: "Quán thật có tọa độ",
              latitude: 21.031,
              longitude: 105.791,
              address: "Cầu Giấy, Hà Nội",
            },
          ],
        },
      },
    }),
  );

  await page.goto("/#map");

  await expect(page.getByRole("region", { name: "Bản đồ tương tác" })).toBeVisible();
  await expect(page.getByText("Quán thật có tọa độ", { exact: true })).toBeVisible();
});
