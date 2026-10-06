import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eatwise_access_token", "test-token");
    sessionStorage.setItem("food_refresh_token", "test-refresh");
  });
  await page.route("**/api/users/me", (r) =>
    r.fulfill({
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
  await page.route("**/api/auth/sessions", (r) =>
    r.fulfill({ json: { data: { items: [] } } }),
  );
  await page.route("**/api/auth/email-status", (r) =>
    r.fulfill({
      json: {
        data: {
          email: "owner@example.com",
          emailVerifiedAt: null,
          configured: false,
        },
      },
    }),
  );
  await page.route("**/api/users/me/data-controls", (r) =>
    r.fulfill({
      json: {
        data: {
          deletionAvailable: true,
          retention: {
            conversationsDays: 90,
            actionsDays: 180,
            auditDays: 365,
          },
        },
      },
    }),
  );
});
test("requires password, rejects incomplete exports and downloads only a confirmed complete file", async ({
  page,
}) => {
  let calls = 0,
    downloads = 0;
  page.on("download", () => downloads++);
  await page.route("**/api/users/me/export", (r) => {
    expect(r.request().postDataJSON()).toEqual({
      currentPassword: "data-password",
    });
    calls++;
    if (calls === 1)
      return r.fulfill({
        status: 403,
        json: { error: { code: "ACCOUNT_REAUTH_REQUIRED" } },
      });
    const text =
      JSON.stringify({
        type: "account",
        data: { email: "owner@example.com" },
      }) + "\n";
    return r.fulfill({
      contentType: "application/x-ndjson",
      body:
        text +
        (calls === 2
          ? ""
          : JSON.stringify({ type: "complete", rows: 1 }) + "\n"),
    });
  });
  await page.goto("/#account");
  await page
    .getByRole("button", { name: "Xuất dữ liệu cá nhân", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await expect(
    modal.getByRole("button", { name: "Xác nhận tải dữ liệu" }),
  ).toBeDisabled();
  await modal
    .getByLabel("Mật khẩu hiện tại để xác nhận", { exact: true })
    .fill("data-password");
  await modal.getByRole("button", { name: "Xác nhận tải dữ liệu" }).click();
  await expect(modal.getByRole("alert")).toContainText(
    "Mật khẩu hiện tại chưa đúng",
  );
  await expect(
    modal.getByLabel("Mật khẩu hiện tại để xác nhận", { exact: true }),
  ).toHaveValue("data-password");
  await modal.getByRole("button", { name: "Xác nhận tải dữ liệu" }).click();
  await expect(modal.getByRole("alert")).toContainText(
    "Phiên tải bị gián đoạn",
  );
  expect(downloads).toBe(0);
  const download = page.waitForEvent("download");
  await modal.getByRole("button", { name: "Xác nhận tải dữ liệu" }).click();
  expect((await download).suggestedFilename()).toBe(
    "eatwise-personal-data.jsonl",
  );
  await expect(
    page.getByText(/Đã chuẩn bị tệp dữ liệu cá nhân đầy đủ/),
  ).toBeVisible();
  expect(calls).toBe(3);
  expect(downloads).toBe(1);
});
test("requires typed confirmation and explicit consent, preserves a failed deletion and signs out only when queued", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/users/me/account", (r) => {
    calls++;
    expect(r.request().method()).toBe("DELETE");
    expect(r.request().postDataJSON()).toEqual({
      currentPassword: "data-password",
      confirm: true,
      confirmation: "XÓA TÀI KHOẢN",
    });
    return calls === 1
      ? r.fulfill({
          status: 503,
          json: { error: { code: "ACCOUNT_DELETION_UNAVAILABLE" } },
        })
      : r.fulfill({
          status: 202,
          json: { data: { status: "DELETION_QUEUED", requestId: id } },
        });
  });
  await page.goto("/#account");
  await page
    .getByRole("button", { name: "Yêu cầu xóa tài khoản", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Mật khẩu hiện tại để xác nhận", { exact: true })
    .fill("data-password");
  await modal
    .getByLabel("Nhập XÓA TÀI KHOẢN để xác nhận", { exact: true })
    .fill("XÓA TÀI KHOẢN");
  await expect(
    modal.getByRole("button", { name: "Xác nhận yêu cầu xóa" }),
  ).toBeDisabled();
  expect(calls).toBe(0);
  await modal.getByRole("checkbox").check();
  await modal.getByRole("button", { name: "Xác nhận yêu cầu xóa" }).click();
  await expect(modal.getByRole("alert")).toContainText(
    "Tài khoản của bạn chưa bị thay đổi",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBe("test-token");
  await expect(
    modal.getByLabel("Mật khẩu hiện tại để xác nhận", { exact: true }),
  ).toHaveValue("data-password");
  await modal.getByRole("button", { name: "Xác nhận yêu cầu xóa" }).click();
  await expect(
    page.getByText(/Đã tiếp nhận yêu cầu xóa tài khoản/),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBeNull();
  expect(
    await page.evaluate(() => sessionStorage.getItem("food_refresh_token")),
  ).toBeNull();
  expect(calls).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("shows disabled cleanup honestly while keeping export available and discloses retention publicly", async ({
  page,
}) => {
  await page.route("**/api/users/me/data-controls", (r) =>
    r.fulfill({
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
  await page.route("**/api/privacy-policy", (r) =>
    r.fulfill({
      json: {
        data: {
          cleanupState: "DISABLED",
          retention: {
            conversationsDays: 90,
            actionsDays: 180,
            auditDays: 365,
          },
        },
      },
    }),
  );
  await page.goto("/#account");
  await expect(
    page.getByRole("button", { name: "Yêu cầu xóa tài khoản", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Xuất dữ liệu cá nhân", exact: true }),
  ).toBeEnabled();
  await page.goto("/#privacy");
  await expect(
    page.getByText(/Dọn dữ liệu định kỳ chưa được bật/),
  ).toBeVisible();
  await expect(page.getByText(/nhật ký hành vi: 180 ngày/)).toBeVisible();
  await expect(page.getByText(/dịch vụ email Resend/)).toBeVisible();
});
