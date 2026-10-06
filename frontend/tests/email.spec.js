import { test, expect } from "@playwright/test";
const token = "a".repeat(43);
test("never claims an unconfigured recovery email was sent and retains the email for retry", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/auth/forgot-password", (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      email: "owner@example.com",
    });
    return calls === 1
      ? route.fulfill({
          status: 503,
          json: { error: { code: "EMAIL_NOT_CONFIGURED" } },
        })
      : route.fulfill({
          json: {
            data: {
              status: "ACCEPTED",
              message:
                "Nếu email thuộc tài khoản đang hoạt động, yêu cầu sẽ được xử lý.",
            },
          },
        });
  });
  await page.goto("/#forgot-password");
  await page
    .getByLabel("Email tài khoản", { exact: true })
    .fill("owner@example.com");
  await page
    .getByRole("button", { name: "Yêu cầu liên kết khôi phục", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Chưa có email nào được gửi",
  );
  await expect(page.getByLabel("Email tài khoản", { exact: true })).toHaveValue(
    "owner@example.com",
  );
  await page
    .getByRole("button", { name: "Yêu cầu liên kết khôi phục", exact: true })
    .click();
  await expect(
    page.getByText(
      "Nếu email thuộc tài khoản đang hoạt động, yêu cầu sẽ được xử lý.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls).toBe(2);
});
test("keeps reset tokens out of URLs and storage, retains a failed password and clears the old session after success", async ({
  page,
}) => {
  let calls = 0;
  await page.addInitScript(() => {
    localStorage.setItem("eatwise_access_token", "old-access");
    sessionStorage.setItem("food_refresh_token", "old-refresh");
  });
  await page.route("**/api/auth/reset-password", (route) => {
    calls++;
    expect(route.request().url()).not.toContain(token);
    expect(route.request().postDataJSON()).toEqual({
      token,
      newPassword: "new-password",
    });
    return calls === 1
      ? route.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE" } },
        })
      : route.fulfill({ status: 204 });
  });
  await page.goto(`/#reset-password/${token}`);
  await expect(page).toHaveURL(/#reset-password$/);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain(token);
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("new-password");
  await page
    .getByLabel("Nhập lại mật khẩu mới", { exact: true })
    .fill("mismatched-password");
  await page
    .getByRole("button", { name: "Xác nhận mật khẩu mới", exact: true })
    .click();
  expect(calls).toBe(0);
  await page
    .getByLabel("Nhập lại mật khẩu mới", { exact: true })
    .fill("new-password");
  await page
    .getByRole("button", { name: "Xác nhận mật khẩu mới", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu mới", { exact: true })).toHaveValue(
    "new-password",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBe("old-access");
  await page
    .getByRole("button", { name: "Xác nhận mật khẩu mới", exact: true })
    .click();
  await expect(
    page.getByText(/Đã đặt lại mật khẩu và thu hồi các phiên cũ/),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("eatwise_access_token")),
  ).toBeNull();
  expect(
    await page.evaluate(() => sessionStorage.getItem("food_refresh_token")),
  ).toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("requires an explicit verification action and explains expired links without pretending success", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/auth/verify-email", (route) => {
    calls++;
    return route.fulfill({
      status: 410,
      json: { error: { code: "EMAIL_LINK_INVALID" } },
    });
  });
  await page.goto(`/#verify-email/${token}`);
  await expect(page).toHaveURL(/#verify-email$/);
  expect(calls).toBe(0);
  await page
    .getByRole("button", { name: "Xác nhận email", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Liên kết đã hết hạn hoặc đã được dùng",
  );
  expect(calls).toBe(1);
  await expect(
    page.getByText("Đã xác minh email.", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Thiếu liên kết hợp lệ/)).toBeVisible();
});
