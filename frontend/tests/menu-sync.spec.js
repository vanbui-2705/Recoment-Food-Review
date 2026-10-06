import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111",
  jobId = "22222222-2222-4222-8222-222222222222";
const supplier = { id, name: "Nguồn thực đơn thử nghiệm", enabled: true };
const schedule = {
  supplierId: id,
  adapterCode: "fixture",
  enabled: true,
  intervalMinutes: 30,
  nextRunAt: "2026-10-07T01:00:00Z",
  updatedAt: "2026-10-07T00:00:00Z",
  supplier,
};
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
  await page.route("**/api/admin/menu/suppliers", (r) =>
    r.fulfill({ json: { data: { items: [supplier] } } }),
  );
});
test("missing adapter is explicit and exposes no sync actions", async ({
  page,
}) => {
  await page.route("**/api/admin/menu/schedules", (r) =>
    r.fulfill({
      json: { data: { workerEnabled: false, adapters: [], items: [] } },
    }),
  );
  await page.route("**/api/admin/menu/sync-jobs?**", (r) =>
    r.fulfill({ json: { data: { items: [], total: 0, page: 1, limit: 20 } } }),
  );
  await page.goto("/#admin");
  await page
    .getByRole("button", { name: "Đồng bộ thực đơn", exact: true })
    .click();
  await expect(
    page.getByText("Chưa có adapter thực đơn", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đồng bộ ngay", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Chưa có lượt đồng bộ ở trang này."),
  ).toBeVisible();
});
test("retry requires confirmation and a fresh version; queued is not successful import", async ({
  page,
}) => {
  let writes = 0,
    row = {
      id: jobId,
      scheduleId: id,
      status: "FAILED",
      attempts: 5,
      retryable: true,
      errorCode: "MENU_SYNC_INTERRUPTED",
      createdAt: "2026-10-07T00:00:00Z",
      updatedAt: "2026-10-07T00:00:00Z",
      schedule: { supplier },
    };
  await page.route("**/api/admin/menu/schedules", (r) =>
    r.fulfill({
      json: {
        data: {
          workerEnabled: true,
          adapters: [{ code: "fixture" }],
          items: [schedule],
        },
      },
    }),
  );
  await page.route("**/api/admin/menu/sync-jobs?**", (r) =>
    r.fulfill({
      json: { data: { items: [row], total: 1, page: 1, limit: 20 } },
    }),
  );
  await page.route(`**/api/admin/menu/sync-jobs/${jobId}`, (r) =>
    r.fulfill({
      json: { data: { ...row, updatedAt: "2026-10-07T00:01:00Z" } },
    }),
  );
  await page.route(`**/api/admin/menu/sync-jobs/${jobId}/retry`, (r) => {
    writes++;
    const body = r.request().postDataJSON();
    expect(body.confirm).toBe(true);
    if (writes === 1)
      return r.fulfill({
        status: 409,
        json: { error: { code: "MENU_SYNC_CHANGED" } },
      });
    expect(body.expectedUpdatedAt).toBe("2026-10-07T00:01:00Z");
    row = { ...row, status: "QUEUED", attempts: 0, errorCode: null };
    return r.fulfill({ json: { data: row } });
  });
  await page.goto("/#admin");
  await page
    .getByRole("button", { name: "Đồng bộ thực đơn", exact: true })
    .click();
  await page.getByRole("button", { name: "Thử lại lượt đồng bộ" }).click();
  expect(writes).toBe(0);
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Xác nhận đồng bộ" }).click();
  await expect(
    modal.getByRole("button", { name: "Xác nhận đồng bộ" }),
  ).toBeDisabled();
  await modal
    .getByRole("button", { name: "Tải trạng thái mới trước khi xác nhận" })
    .click();
  await expect(
    modal.getByRole("button", { name: "Xác nhận đồng bộ" }),
  ).toBeEnabled();
  await modal.getByRole("button", { name: "Xác nhận đồng bộ" }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "thực đơn chưa được thay đổi",
  );
  await expect(page.getByText("Đang chờ · 0 lần xử lý")).toBeVisible();
});
test("failed manual sync keeps the same request key and denied access hides data", async ({
  page,
}) => {
  let writes = 0,
    key;
  await page.route("**/api/admin/menu/schedules", (r) =>
    r.fulfill({
      json: {
        data: {
          workerEnabled: true,
          adapters: [{ code: "fixture" }],
          items: [schedule],
        },
      },
    }),
  );
  await page.route("**/api/admin/menu/sync-jobs?**", (r) =>
    r.fulfill({ json: { data: { items: [], total: 0, page: 1, limit: 20 } } }),
  );
  await page.route(`**/api/admin/menu/schedules/${id}/run`, (r) => {
    writes++;
    const body = r.request().postDataJSON();
    if (writes === 1) {
      key = body.idempotencyKey;
      return r.fulfill({
        status: 503,
        json: { error: { code: "MENU_SYNC_NOT_CONFIGURED" } },
      });
    }
    expect(body.idempotencyKey).toBe(key);
    return r.fulfill({
      status: 202,
      json: { data: { id: jobId, status: "QUEUED" } },
    });
  });
  await page.goto("/#admin");
  await page
    .getByRole("button", { name: "Đồng bộ thực đơn", exact: true })
    .click();
  await page.getByRole("button", { name: "Đồng bộ ngay", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận đồng bộ" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận đồng bộ" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.route("**/api/admin/menu/schedules", (r) =>
    r.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } }),
  );
  await page
    .getByRole("button", { name: "Tải lại trạng thái đồng bộ" })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đồng bộ ngay", exact: true }),
  ).toHaveCount(0);
});
