import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/recommendations/today", (r) =>
    r.fulfill({ json: { data: { status: "NO_MATCH", items: [] } } }),
  );
  await page.route("**/api/recipes/today", (r) =>
    r.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );
});

test("keeps offline warning until reconnect and allows dismissing the recovery notice", async ({
  page,
}) => {
  await page.route("**/api/users/me/*-history", (r) =>
    r.fulfill({ json: { data: { items: [] } } }),
  );
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(
    page.getByText("Bạn đang ngoại tuyến", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Đã chọn / đã ăn", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đã chọn & đã ăn", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bạn đang ngoại tuyến", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Bạn đang ngoại tuyến", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Đã có kết nối mạng trở lại/)).toBeVisible();
  await page
    .getByRole("button", { name: "Đóng thông báo", exact: true })
    .click();
  await expect(page.getByText(/Đã có kết nối mạng trở lại/)).toHaveCount(0);
});

test("shows session expiry on login instead of silently removing the user", async ({
  page,
}) => {
  await page.route("**/api/recommendations/today", (r) =>
    r.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } }),
  );
  await page.goto("/");
  await expect(
    page.getByText("Phiên đăng nhập đã hết hạn", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("eatwise_access_token")),
    )
    .toBeNull();
});

test("retains unsaved taste text after network failure and never reports a successful save", async ({
  page,
}) => {
  await page.route("**/api/users/me/food-knowledge", (r) =>
    r.request().method() === "PUT"
      ? r.abort()
      : r.fulfill({ json: { data: { knowledge: null } } }),
  );
  await page.goto("/#profile");
  const input = page.getByRole("textbox", { name: "Mô tả khẩu vị của bạn" });
  await input.fill("Tôi thích món ít cay");
  await expect(page.getByText(/Bạn có thay đổi chưa lưu/)).toBeVisible();
  await page
    .getByRole("button", { name: "Lưu mô tả khẩu vị", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "thao tác vừa rồi chưa được xác nhận thành công",
  );
  await expect(input).toHaveValue("Tôi thích món ít cay");
  await expect(
    page.getByText("Đã lưu mô tả khẩu vị vào tài khoản của bạn.", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("explains AI quota failures and preserves retry without exposing provider errors", async ({
  page,
}) => {
  await page.route("**/api/recommendations/today", (r) =>
    r.fulfill({
      json: { data: { status: "PROFILE_PENDING_ANALYSIS", items: [] } },
    }),
  );
  await page.route("**/api/users/me/food-knowledge/analyses", (r) =>
    r.fulfill({
      json: {
        data: {
          configured: true,
          analysis: {
            id: "11111111-1111-4111-8111-111111111111",
            sourceRevision: 1,
            status: "FAILED",
            errorCode: "AI_QUOTA_EXCEEDED",
            result: null,
          },
        },
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByText(/Phân tích khẩu vị đã đạt hạn mức/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Phân tích lại mô tả", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("sanitizes server errors and tells the user to retry", async ({
  page,
}) => {
  await page.route("**/api/recommendations/today", (r) =>
    r.fulfill({
      status: 500,
      json: {
        error: {
          code: "INTERNAL_ERROR",
          message: "private-provider-key-and-stack",
        },
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Hệ thống tạm thời chưa xử lý được yêu cầu",
  );
  await expect(page.getByText(/private-provider-key/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Thử lại", exact: true }),
  ).toBeVisible();
});
