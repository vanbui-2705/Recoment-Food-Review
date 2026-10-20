import { expect, test } from "@playwright/test";

const mockSession = async (page) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "location-test-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "GPS User", email: "gps@example.com" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            areaLabel: "Vị trí đã lưu",
            latitude: 21.03,
            longitude: 105.79,
            maxDistanceMeters: 3500,
            allergies: [],
          },
        },
      },
    }),
  );
};

test("map automatically requests nearby places with the browser's current coordinates", async ({ context, page }, testInfo) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 10.775, longitude: 106.7 });
  await mockSession(page);

  let gpsRequestSeen = false;
  await page.route("**/api/discovery/nearby-food?*", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("latitude") === "10.775" && url.searchParams.get("longitude") === "106.7") {
      gpsRequestSeen = true;
    }
    return route.fulfill({ json: { data: { status: "SUCCESS", items: [], restaurants: [] } } });
  });

  await page.goto("/#map");

  await expect(page.getByRole("button", { name: "Đang dùng GPS" })).toBeVisible();
  if (testInfo.project.name === "desktop")
    await expect(page.getByText("GPS 10.7750, 106.7000", { exact: true })).toBeVisible();
  await expect.poll(() => gpsRequestSeen).toBe(true);
  await expect(page.locator('iframe[title*="Vị trí hiện tại"]')).toBeVisible();
});

test("location permission errors are visible and do not pretend GPS succeeded", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success, error) =>
          error({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 }),
      },
    });
  });
  await mockSession(page);
  await page.route("**/api/discovery/nearby-food?*", (route) =>
    route.fulfill({ json: { data: { status: "SUCCESS", items: [], restaurants: [] } } }),
  );

  await page.goto("/#map");

  await expect(page.getByRole("alert")).toContainText("chưa cấp quyền");
  await expect(page.getByRole("button", { name: "Thử lại vị trí" })).toBeVisible();
});
