import { test, expect } from "@playwright/test";
const id = "55555555-5555-4555-8555-555555555555";
const headers = { "content-type": "application/json" };
const summary = {
  generatedAt: "2026-10-07T03:00:00.000Z",
  aiBudget: {
    limitMicros: "10000000",
    reservedMicros: "1000000",
    requests: 1,
    pricingValidUntil: "2027-01-01",
    model: "gemini-3.8-flash",
  },
  providers: [
    {
      source: "google",
      configured: false,
      status: "NOT_CONFIGURED",
      minuteLimit: 120,
      used: 0,
      requests: "0",
      failures: "0",
      quotaRejections: "0",
      lastAttemptAt: null,
      lastSuccessAt: null,
    },
  ],
  capabilities: {
    workerEnabled: true,
    aiConfigured: false,
    emailConfigured: false,
  },
  jobs: {
    analysis: [],
    chat: [],
    email: [],
    deletion: [{ status: "FAILED", _count: 1 }],
  },
  retention: { lastCompletedAt: null, nextRunAt: null, lastErrorCode: null },
};
async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem("eatwise_access_token", "test-token");
  });
  await page.route("**/api/users/me", (route) =>
    route.fulfill({
      headers,
      body: JSON.stringify({
        data: { id, displayName: "Test", role: "ADMIN" },
      }),
    }),
  );
  await page.route("**/api/admin/menu/**", (route) =>
    route.fulfill({ headers, body: JSON.stringify({ data: { items: [] } }) }),
  );
  await page.route("**/api/admin/access-check", (route) =>
    route.fulfill({
      headers,
      body: JSON.stringify({ data: { authorized: true } }),
    }),
  );
  await page.route("**/api/catalogs/*", (route) =>
    route.fulfill({
      headers,
      body: JSON.stringify({
        data: { dishes: [], allergens: [], dietaryRestrictions: [] },
      }),
    }),
  );
  await page.goto("/#admin");
  await page.getByRole("button", { name: "Vận hành và API" }).click();
}
test("shows unconfigured APIs honestly and requires confirmation before retrying a failed deletion", async ({
  page,
}) => {
  const job = {
    id,
    status: "FAILED",
    attempts: 5,
    requestedAt: summary.generatedAt,
    updatedAt: summary.generatedAt,
    errorCode: "ACCOUNT_DELETE_FAILED",
  };
  let status = "FAILED",
    writes = [];
  await page.route("**/api/admin/operations", (route) =>
    route.fulfill({ headers, body: JSON.stringify({ data: summary }) }),
  );
  await page.route("**/api/admin/operations/account-deletions?**", (route) =>
    route.fulfill({
      headers,
      body: JSON.stringify({
        data: { items: [{ ...job, status }], nextCursor: null },
      }),
    }),
  );
  await page.route(
    `**/api/admin/operations/account-deletions/${id}/retry`,
    (route) => {
      writes.push(route.request().postDataJSON());
      status = "QUEUED";
      return route.fulfill({
        headers,
        body: JSON.stringify({ data: { id, status } }),
      });
    },
  );
  await setup(page);
  await expect(
    page.getByRole("heading", { name: "Google Places" }),
  ).toBeVisible();
  await expect(page.getByText("Chưa cấu hình", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ngân sách AI hôm nay" }),
  ).toBeVisible();
  await expect(page.getByText(/không phải hóa đơn provider/)).toBeVisible();
  await page
    .getByRole("button", { name: "Xử lý lại yêu cầu xóa", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Xử lý lại yêu cầu xóa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận xử lý lại", exact: true })
    .click();
  await expect(
    page.getByText(
      "Đã đưa yêu cầu trở lại hàng đợi. Dữ liệu chưa được xác nhận xóa hoàn tất.",
    ),
  ).toBeVisible();
  expect(writes).toEqual([
    { confirm: true, expectedUpdatedAt: summary.generatedAt },
  ]);
  await expect(
    page.getByRole("button", { name: "Xử lý lại yêu cầu xóa", exact: true }),
  ).toHaveCount(0);
});
test("hides operation data and retry controls after access denial", async ({
  page,
}) => {
  await page.route("**/api/admin/operations", (route) =>
    route.fulfill({
      status: 403,
      headers,
      body: JSON.stringify({
        error: { code: "FORBIDDEN", message: "Không có quyền quản trị." },
      }),
    }),
  );
  await setup(page);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Google Places" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Xử lý lại yêu cầu xóa" }),
  ).toHaveCount(0);
});
test("reloads stale deletion state without repeating the write or showing a success notice", async ({
  page,
}) => {
  let status = "FAILED",
    writes = 0;
  const job = {
    id,
    status,
    attempts: 5,
    requestedAt: summary.generatedAt,
    updatedAt: summary.generatedAt,
  };
  await page.route("**/api/admin/operations", (route) =>
    route.fulfill({ json: { data: summary } }),
  );
  await page.route("**/api/admin/operations/account-deletions?**", (route) =>
    route.fulfill({
      json: { data: { items: [{ ...job, status }], nextCursor: null } },
    }),
  );
  await page.route(
    `**/api/admin/operations/account-deletions/${id}/retry`,
    (route) => {
      writes++;
      status = "QUEUED";
      return route.fulfill({
        status: 409,
        json: { error: { code: "DELETION_JOB_CONFLICT" } },
      });
    },
  );
  await setup(page);
  await page
    .getByRole("button", { name: "Xử lý lại yêu cầu xóa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận xử lý lại", exact: true })
    .click();
  await expect(
    page.getByText(
      "Yêu cầu đã thay đổi hoặc được xử lý. Danh sách đang được tải lại; kiểm tra trạng thái mới trước khi thao tác.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Xử lý lại yêu cầu xóa", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Đã đưa yêu cầu trở lại hàng đợi. Dữ liệu chưa được xác nhận xóa hoàn tất.",
    ),
  ).toHaveCount(0);
  expect(writes).toBe(1);
});
