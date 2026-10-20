import { expect, test } from "@playwright/test";

async function openAuthenticatedDashboard(page) {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "auth-redirect-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "Auth User", email: "auth@example.com" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({ json: { data: { profile: { allergies: [] } } } }),
  );
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({ json: { data: { status: "NO_MATCH", items: [] } } }),
  );
  await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );
  await page.goto("/");
  await expect(page.getByText("Auth User")).toBeVisible();
}

test("logout removes the dashboard and opens login", async ({ page }) => {
  await openAuthenticatedDashboard(page);
  await page.route("**/api/auth/logout", (route) => route.fulfill({ status: 204 }));

  await page.getByRole("button", { name: "Đăng xuất" }).click();

  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("eatwise_access_token"))).toBeNull();
});

test("expired session removes the dashboard and opens login", async ({ page }) => {
  await openAuthenticatedDashboard(page);

  await page.evaluate(() => window.dispatchEvent(new Event("food-session-expired")));

  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(0);
});

test("successful login stores the session and opens the dashboard", async ({ page }) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      json: {
        data: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
        },
      },
    }),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "Logged In", email: "login@example.com" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({ json: { data: { profile: { allergies: [] } } } }),
  );
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({ json: { data: { status: "NO_MATCH", items: [] } } }),
  );
  await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );

  await page.goto("/");
  await page.getByLabel("Email").fill("login@example.com");
  await page.getByLabel("Mật khẩu").fill("password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  await expect(page.getByText("Logged In")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("eatwise_access_token"))).toBe("new-access-token");
});
