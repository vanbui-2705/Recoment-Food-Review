import { expect, test } from "@playwright/test";

const user = {
  id: "12345678-1234-4234-8234-123456789012",
  displayName: "Tài khoản thật",
  email: "live@example.com",
  role: "USER",
  createdAt: new Date().toISOString(),
};

const profile = {
  latitude: 21.03,
  longitude: 105.78,
  areaLabel: "Cầu Giấy, Hà Nội",
  mealPeriod: "LUNCH",
  spicyLevel: 30,
  sweetLevel: 45,
  sourLevel: 30,
  saltyLevel: 40,
  budgetMin: 0,
  budgetMax: 70000,
  maxDistanceMeters: 3500,
  onboardingCompleted: true,
  allergies: [
    { code: "SHELLFISH", severity: "SEVERE", notes: null },
    { code: "SESAME", severity: "MILD", notes: "preserve" },
  ],
  dietaryRestrictions: [],
  cuisinePreferences: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user } } }),
  );
  await page.route(/\/api\/catalogs\/(allergens|dietary-restrictions|cuisines)$/, (route) =>
    route.fulfill({ json: { data: { items: [] } } }),
  );
});

test("loads the live profile and saves compatible fields exactly once", async ({
  page,
}) => {
  const writes = [];
  await page.route("**/api/users/me/profile", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push(body);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return route.fulfill({
        json: { data: { profile: { ...profile, allergies: body.allergies } } },
      });
    }
    return route.fulfill({ json: { data: { profile } } });
  });

  await page.goto("/#profile");
  await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();

  await page
    .getByText("Đậu phộng / Lạc", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'cursor-pointer')]")
    .click();
  const save = page.getByRole("button", { name: "Lưu Thay Đổi" });
  await save.evaluate((element) => {
    element.click();
    element.click();
  });

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].allergies.map((item) => item.code).sort()).toEqual([
    "PEANUT",
    "SESAME",
    "SHELLFISH",
  ]);
  expect(writes[0]).toMatchObject({
    latitude: profile.latitude,
    longitude: profile.longitude,
    budgetMax: profile.budgetMax,
    maxDistanceMeters: profile.maxDistanceMeters,
  });
  await expect(page.getByRole("status")).toContainText(
    "Đã cập nhật Hồ sơ Vị giác",
  );
});

test("keeps the edited profile and never reports success when save fails", async ({
  page,
}) => {
  await page.route("**/api/users/me/profile", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE" } },
        })
      : route.fulfill({ json: { data: { profile } } }),
  );

  await page.goto("/#profile");
  await page
    .getByText("Đậu phộng / Lạc", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'cursor-pointer')]")
    .click();
  await page.getByRole("button", { name: "Lưu Thay Đổi" }).click();

  await expect(page.getByRole("status")).not.toContainText(
    "Đã cập nhật Hồ sơ Vị giác",
  );
  await expect(
    page
      .getByText("Đậu phộng / Lạc", { exact: true })
      .locator("xpath=ancestor::div[contains(@class, 'cursor-pointer')]")
      .locator("div.bg-red-500"),
  ).toHaveCount(1);
});

test("shows backend validation failure without a success notice", async ({
  page,
}) => {
  await page.route("**/api/users/me/profile", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 400,
          json: {
            error: {
              code: "VALIDATION_ERROR",
              message: "Hồ sơ không hợp lệ.",
            },
          },
        })
      : route.fulfill({ json: { data: { profile } } }),
  );

  await page.goto("/#profile");
  await page.getByRole("button", { name: "Lưu Thay Đổi" }).click();
  await expect(page.getByRole("status")).toContainText("Hồ sơ không hợp lệ.");
  await expect(page.getByRole("status")).not.toContainText(
    "Đã cập nhật Hồ sơ Vị giác",
  );
});

test("refreshes one expired session and retries the original account request", async ({
  page,
}) => {
  let meCalls = 0;
  let refreshCalls = 0;
  await page.addInitScript(() => {
    localStorage.setItem("eatwise_access_token", "expired-token");
    sessionStorage.setItem("food_refresh_token", "refresh-token");
  });
  await page.unroute("**/api/users/me");
  await page.route("**/api/users/me", (route) => {
    meCalls += 1;
    return meCalls === 1
      ? route.fulfill({
          status: 401,
          json: { error: { code: "UNAUTHORIZED" } },
        })
      : route.fulfill({ json: { data: { user } } });
  });
  await page.route("**/api/auth/refresh", (route) => {
    refreshCalls += 1;
    return route.fulfill({
      json: {
        data: {
          user,
          accessToken: "rotated-access-token",
          refreshToken: "rotated-refresh-token",
          expiresIn: 900,
        },
      },
    });
  });
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({ json: { data: { profile } } }),
  );

  await page.goto("/#profile");
  await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
  expect(meCalls).toBeGreaterThanOrEqual(2);
  expect(meCalls).toBeLessThanOrEqual(3);
  expect(refreshCalls).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBe("rotated-access-token");
  expect(
    await page.evaluate(() => sessionStorage.getItem("food_refresh_token")),
  ).toBe("rotated-refresh-token");
});
