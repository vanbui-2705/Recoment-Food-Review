import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
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
test("operator pause requires confirmation and fresh version after concurrent change", async ({
  page,
}) => {
  let writes = 0;
  let row = {
    id,
    name: "Cơm gà",
    isActive: true,
    updatedAt: "2026-10-07T00:00:00Z",
  };
  await page.route("**/api/admin/content/dishes?**", (r) =>
    r.fulfill({
      json: { data: { items: [row], total: 1, page: 1, limit: 20 } },
    }),
  );
  await page.route(`**/api/admin/content/dishes/${id}`, (r) =>
    r.fulfill({
      json: { data: { ...row, updatedAt: "2026-10-07T00:01:00Z" } },
    }),
  );
  await page.route(`**/api/admin/content/dishes/${id}/status`, (r) => {
    writes++;
    const body = r.request().postDataJSON();
    expect(body.confirm).toBe(true);
    expect(body.isActive).toBe(false);
    if (writes === 1)
      return r.fulfill({
        status: 409,
        json: { error: { code: "CONTENT_CHANGED" } },
      });
    expect(body.expectedUpdatedAt).toBe("2026-10-07T00:01:00Z");
    row = { ...row, isActive: false };
    return r.fulfill({ json: { data: row } });
  });
  await page.goto("/#admin");
  await page
    .getByRole("button", { name: "Danh mục và quán", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tạm ngừng gợi ý", exact: true })
    .click();
  expect(writes).toBe(0);
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Xác nhận lưu" }).click();
  await expect(
    modal.getByRole("button", { name: "Xác nhận lưu" }),
  ).toBeDisabled();
  await modal.getByRole("button", { name: "Tải lại dữ liệu đang sửa" }).click();
  await expect(
    modal.getByRole("button", { name: "Xác nhận lưu" }),
  ).toBeEnabled();
  await modal.getByRole("button", { name: "Xác nhận lưu" }).click();
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Bật lại gợi ý" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("được giữ nguyên");
});
test("catalog creation keeps inputs on error and reports empty and denied lists", async ({
  page,
}) => {
  await page.route("**/api/admin/content/dishes?**", (r) =>
    r.fulfill({ json: { data: { items: [], total: 0, page: 1, limit: 20 } } }),
  );
  await page.route("**/api/admin/content/ingredients?**", (r) =>
    r.fulfill({ json: { data: { items: [], total: 0, page: 1, limit: 20 } } }),
  );
  await page.route("**/api/admin/content/ingredients", (r) =>
    r.fulfill({
      status: 409,
      json: { error: { code: "CATALOG_CODE_EXISTS" } },
    }),
  );
  await page.route("**/api/admin/content/restaurants?**", (r) =>
    r.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } }),
  );
  await page.goto("/#admin");
  await page
    .getByRole("button", { name: "Danh mục và quán", exact: true })
    .click();
  await expect(
    page.getByText("Không có dữ liệu phù hợp.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Loại dữ liệu").selectOption("ingredients");
  await page.getByRole("button", { name: "Thêm nguyên liệu" }).click();
  await page.getByLabel("Mã danh mục").fill("RICE");
  await page.getByLabel("Tên", { exact: true }).fill("Gạo");
  await page.getByRole("button", { name: "Xác nhận lưu" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "đã tồn tại",
  );
  await expect(page.getByLabel("Tên", { exact: true })).toHaveValue("Gạo");
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByLabel("Loại dữ liệu").selectOption("restaurants");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("kết quả · Trang", { exact: false })).toHaveCount(
    0,
  );
});
