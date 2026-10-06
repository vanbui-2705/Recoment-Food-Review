import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111",
  otherId = "22222222-2222-4222-8222-222222222222";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/users/me/data-controls", (route) =>
    route.fulfill({
      json: {
        data: {
          deletionAvailable: false,
          retention: {
            conversationsDays: 90,
            actionsDays: 180,
            auditDays: 365,
          },
        },
      },
    }),
  );
  await page.route("**/api/auth/email-status", (route) =>
    route.fulfill({
      json: {
        data: {
          email: "owner@example.com",
          emailVerifiedAt: null,
          configured: false,
        },
      },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({
      json: {
        data: {
          user: {
            id,
            email: "owner@example.com",
            displayName: "Owner",
            role: "USER",
          },
        },
      },
    }),
  );
  await page.route("**/api/auth/sessions", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id,
              device: "Chrome current",
              current: true,
              expiresAt: "2026-11-01T00:00:00Z",
            },
            {
              id: otherId,
              device: "Another phone",
              current: false,
              expiresAt: "2026-11-01T00:00:00Z",
            },
          ],
        },
      },
    }),
  );
});
test("retains a failed name, confirms device revocation and clears local credentials after logout-all", async ({
  page,
}) => {
  let attempts = 0,
    deletes = 0,
    all = 0;
  await page.route("**/api/users/me/name", (route) => {
    expect(route.request().postDataJSON()).toEqual({ displayName: "Tên mới" });
    return ++attempts === 1
      ? route.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE" } },
        })
      : route.fulfill({ json: { data: { displayName: "Tên mới" } } });
  });
  await page.route(`**/api/auth/sessions/${otherId}`, (route) => {
    deletes++;
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/auth/logout-all", (route) => {
    all++;
    return route.fulfill({ status: 204 });
  });
  await page.goto("/#account");
  await page.getByLabel("Tên hiển thị", { exact: true }).fill("Tên mới");
  await page.getByRole("button", { name: "Lưu tên", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Tên hiển thị", { exact: true })).toHaveValue(
    "Tên mới",
  );
  await page.getByRole("button", { name: "Lưu tên", exact: true }).click();
  await expect(
    page.getByText("Đã cập nhật tên hiển thị.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Đăng xuất thiết bị này", exact: true })
    .click();
  expect(deletes).toBe(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Giữ phiên đăng nhập" })
    .click();
  expect(deletes).toBe(0);
  await page
    .getByRole("button", { name: "Đăng xuất thiết bị này", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận đăng xuất" })
    .click();
  await expect(page.getByText("Another phone", { exact: true })).toHaveCount(0);
  expect(deletes).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBe("test-token");
  await page
    .getByRole("button", { name: "Đăng xuất tất cả thiết bị", exact: true })
    .click();
  expect(all).toBe(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận đăng xuất" })
    .click();
  await expect(
    page.getByText(
      "Đã thu hồi phiên đăng nhập. Hãy đăng nhập lại khi cần sử dụng app.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(all).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBeNull();
});
test("validates password confirmation locally and retains inputs on an invalid current password", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/auth/change-password", (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          status: 401,
          json: { error: { code: "INVALID_CURRENT_PASSWORD" } },
        })
      : route.fulfill({ status: 204 });
  });
  await page.goto("/#account");
  await page
    .getByLabel("Mật khẩu hiện tại", { exact: true })
    .fill("current-password");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("new-password");
  await page
    .getByLabel("Nhập lại mật khẩu mới", { exact: true })
    .fill("mismatch-password");
  await page
    .getByRole("button", { name: "Đổi mật khẩu và đăng xuất", exact: true })
    .click();
  await expect(
    page.getByText("Mật khẩu xác nhận chưa khớp với mật khẩu mới.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(calls).toBe(0);
  await page
    .getByLabel("Nhập lại mật khẩu mới", { exact: true })
    .fill("new-password");
  await page
    .getByRole("button", { name: "Đổi mật khẩu và đăng xuất", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu mới", { exact: true })).toHaveValue(
    "new-password",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBe("test-token");
  await page
    .getByRole("button", { name: "Đổi mật khẩu và đăng xuất", exact: true })
    .click();
  await expect(
    page.getByText(
      "Đã đổi mật khẩu và đăng xuất tất cả thiết bị. Hãy đăng nhập bằng mật khẩu mới.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls).toBe(2);
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
