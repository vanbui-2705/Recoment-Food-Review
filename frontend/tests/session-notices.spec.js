import { test, expect } from "@playwright/test";

for (const accepted of [true, false]) {
  test(`refresh token ${accepted ? "restores the session without an expiry warning" : "cannot keep a rejected session signed in"}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("eatwise_access_token", "expired-token");
      sessionStorage.setItem("food_refresh_token", "refresh-token");
    });
    await page.route("**/api/auth/refresh", (r) =>
      r.fulfill({
        json: {
          data: {
            accessToken: "renewed-token",
            refreshToken: "renewed-refresh",
          },
        },
      }),
    );
    await page.route("**/api/recipes/today", (r) =>
      r.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
    );
    await page.route("**/api/recommendations/today", (r) =>
      accepted && r.request().headers().authorization === "Bearer renewed-token"
        ? r.fulfill({ json: { data: { status: "NO_MATCH", items: [] } } })
        : r.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } }),
    );
    await page.goto("/");
    if (accepted) {
      await expect(
        page.getByRole("heading", {
          name: "Chưa có món phù hợp lúc này",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Phiên đăng nhập đã hết hạn", { exact: true }),
      ).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(() => localStorage.getItem("eatwise_access_token")),
        )
        .toBe("renewed-token");
    } else {
      await expect(
        page.getByText("Phiên đăng nhập đã hết hạn", { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() => sessionStorage.getItem("food_refresh_token")),
        )
        .toBeNull();
    }
  });
}

test("distinguishes invalid login credentials from session expiry", async ({
  page,
}) => {
  await page.route("**/api/auth/login", (r) =>
    r.fulfill({
      status: 401,
      json: {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email hoặc mật khẩu không đúng.",
        },
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("test@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Email hoặc mật khẩu không đúng.",
  );
  await expect(
    page.getByText("Phiên đăng nhập đã hết hạn", { exact: true }),
  ).toHaveCount(0);
});
