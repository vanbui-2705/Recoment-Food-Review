import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
});
test("reports a recipe with the real reference and retains note and key after failure", async ({
  page,
}) => {
  await page.route("**/api/recipes/themealdb/1", (route) =>
    route.fulfill({
      json: {
        data: {
          recipe: {
            id: "1",
            source: "themealdb",
            title: "Phở bò",
            ingredients: ["Bánh phở"],
            steps: ["Nấu nước dùng"],
            language: "SOURCE_ORIGINAL",
          },
        },
      },
    }),
  );
  let attempts = 0,
    firstKey;
  await page.route("**/api/users/me/data-reports", (route) => {
    const body = route.request().postDataJSON();
    expect(body.target).toEqual({
      kind: "RECIPE",
      source: "themealdb",
      id: "1",
    });
    expect(body.reason).toBe("INGREDIENTS");
    expect(body.note).toBe("Nguồn thiếu lượng nguyên liệu");
    if (++attempts === 1) {
      firstKey = body.idempotencyKey;
      return route.fulfill({
        status: 503,
        json: { error: { code: "SERVICE_UNAVAILABLE" } },
      });
    }
    expect(body.idempotencyKey).toBe(firstKey);
    return route.fulfill({ json: { data: { id, status: "OPEN" } } });
  });
  await page.goto("/#recipe/themealdb/1");
  await page.getByRole("button", { name: "Báo thông tin sai" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Thông tin cần kiểm tra").selectOption("INGREDIENTS");
  await dialog
    .getByLabel("Mô tả thông tin sai")
    .fill("Nguồn thiếu lượng nguyên liệu");
  await dialog
    .getByRole("button", { name: "Gửi báo cáo", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Mô tả thông tin sai")).toHaveValue(
    "Nguồn thiếu lượng nguyên liệu",
  );
  await expect(page.getByText(/Đã gửi báo cáo để quản trị/)).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Gửi báo cáo", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/Đã gửi báo cáo để quản trị/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("admin reloads a changed report before retrying review and keeps the reason", async ({
  page,
}) => {
  await page.route("**/api/admin/menu/**", (route) =>
    route.fulfill({ json: { data: { items: [] } } }),
  );
  await page.route("**/api/catalogs/*", (route) =>
    route.fulfill({ json: { data: { items: [] } } }),
  );
  let report = {
      id,
      targetKind: "PLACE",
      targetSource: "google",
      targetId: "place_1",
      reason: "WRONG_ADDRESS",
      note: "Quán đã chuyển địa chỉ",
      status: "OPEN",
      createdAt: "2026-10-07T00:00:00.000Z",
      updatedAt: "2026-10-07T00:00:00.000Z",
      reviews: [],
    },
    attempts = 0;
  await page.route("**/api/admin/data-reports?**", (route) =>
    route.fulfill({
      json: {
        data: {
          items: report.status === "RESOLVED" ? [] : [report],
          total: report.status === "RESOLVED" ? 0 : 1,
          page: 1,
          limit: 20,
        },
      },
    }),
  );
  await page.route(`**/api/admin/data-reports/${id}`, (route) =>
    route.fulfill({ json: { data: report } }),
  );
  await page.route(`**/api/admin/data-reports/${id}/review`, (route) => {
    const body = route.request().postDataJSON();
    expect(body.reason).toBe("Đã kiểm tra địa chỉ tại nguồn");
    if (++attempts === 1) {
      report = {
        ...report,
        status: "IN_REVIEW",
        updatedAt: "2026-10-07T00:01:00.000Z",
      };
      return route.fulfill({
        status: 409,
        json: { error: { code: "REPORT_REVIEW_CONFLICT" } },
      });
    }
    expect(body.expectedUpdatedAt).toBe(report.updatedAt);
    expect(body.status).toBe("RESOLVED");
    report = { ...report, status: "RESOLVED" };
    return route.fulfill({ json: { data: report } });
  });
  await page.goto("/#admin");
  await page
    .getByRole("button", { name: "Báo cáo dữ liệu", exact: true })
    .click();
  await page.getByRole("button", { name: "Kiểm tra và xử lý báo cáo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Trạng thái mới").selectOption("RESOLVED");
  await dialog
    .getByLabel("Lý do xử lý hoặc mở lại")
    .fill("Đã kiểm tra địa chỉ tại nguồn");
  await dialog.getByRole("button", { name: "Lưu xử lý báo cáo" }).click();
  await expect(dialog.getByRole("alert")).toContainText("phiên khác");
  await dialog
    .getByRole("button", { name: "Tải lại báo cáo", exact: true })
    .click();
  await expect(dialog.getByLabel("Lý do xử lý hoặc mở lại")).toHaveValue(
    "Đã kiểm tra địa chỉ tại nguồn",
  );
  await dialog.getByLabel("Trạng thái mới").selectOption("RESOLVED");
  await dialog.getByRole("button", { name: "Lưu xử lý báo cáo" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText(/Đã cập nhật trạng thái và lưu lịch sử/),
  ).toBeVisible();
});
