import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111",
  actorId = "22222222-2222-4222-8222-222222222222";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/admin/access-check", (r) =>
    r.fulfill({ json: { data: { authorized: true } } }),
  );
  await page.route("**/api/admin/menu/**", (r) =>
    r.fulfill({ json: { data: { items: [] } } }),
  );
  await page.route("**/api/catalogs/*", (r) =>
    r.fulfill({
      json: { data: { dishes: [], allergens: [], dietaryRestrictions: [] } },
    }),
  );
});
test("requires confirmation, reloads a stale status before retry and shows the audit page", async ({
  page,
}) => {
  let writes = 0;
  let row = {
    id,
    email: "user@example.com",
    displayName: "Người dùng",
    role: "USER",
    status: "ACTIVE",
    updatedAt: "2026-10-07T00:00:00Z",
  };
  await page.route("**/api/admin/users?**", (r) =>
    r.fulfill({
      json: {
        data: {
          items: [row],
          page: 1,
          limit: 20,
          total: 1,
          currentUserId: actorId,
        },
      },
    }),
  );
  await page.route(`**/api/admin/users/${id}`, (r) =>
    r.fulfill({
      json: { data: { ...row, updatedAt: "2026-10-07T00:01:00Z" } },
    }),
  );
  await page.route(`**/api/admin/users/${id}/status`, (r) => {
    const body = r.request().postDataJSON();
    writes++;
    expect(body.status).toBe("DISABLED");
    if (writes === 1)
      return r.fulfill({
        status: 409,
        json: { error: { code: "USER_STATUS_CHANGED" } },
      });
    expect(body.expectedUpdatedAt).toBe("2026-10-07T00:01:00Z");
    row = { ...row, status: "DISABLED" };
    return r.fulfill({ json: { data: row } });
  });
  await page.route("**/api/admin/audit?**", (r) =>
    r.fulfill({
      json: {
        data: {
          items: [
            {
              id,
              actorId,
              targetId: id,
              action: "USER_STATUS_REVIEW",
              metadata: {
                from: "ACTIVE",
                to: "DISABLED",
                reasonCode: "SECURITY",
              },
              createdAt: "2026-10-07T00:01:00Z",
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        },
      },
    }),
  );
  await page.goto("/#admin");
  await page.getByRole("button", { name: "Người dùng", exact: true }).click();
  await page
    .getByRole("button", { name: "Khóa tài khoản", exact: true })
    .click();
  expect(writes).toBe(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận thay đổi" })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Xác nhận thay đổi" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Tải lại trạng thái trước khi xác nhận" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận thay đổi" })
    .click();
  await expect(
    page.getByRole("button", { name: "Mở lại tài khoản", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(2);
  await page
    .getByRole("button", { name: "Nhật ký quản trị", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "USER_STATUS_REVIEW", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("hides user data and write controls when access is denied", async ({
  page,
}) => {
  await page.route("**/api/admin/users?**", (r) =>
    r.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } }),
  );
  await page.goto("/#admin");
  await page.getByRole("button", { name: "Người dùng", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Khóa tài khoản", exact: true }),
  ).toHaveCount(0);
});
