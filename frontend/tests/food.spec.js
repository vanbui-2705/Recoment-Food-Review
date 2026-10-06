import { test, expect } from "@playwright/test";
const dish = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Phở bò",
  description: "Bánh phở, thịt bò và nước dùng",
  cuisine: { name: "Việt Nam" },
  priceMin: 40000,
  priceMax: 90000,
  reason: "Phù hợp khẩu vị",
  verificationStatus: "REVIEWED",
  aliases: [],
  ingredients: [],
  allergens: [],
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/recipes/today", (route) =>
    route.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );
});
test("loads today immediately and removes chosen dish after persisting", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let chosen = false;
  let requestBody;
  await page.route("**/api/recommendations/today", (route) =>
    route.fulfill({
      json: {
        data: {
          status: chosen ? "NO_MATCH" : "SUCCESS",
          items: chosen ? [] : [dish],
          excludedRecentCount: chosen ? 1 : 0,
        },
      },
    }),
  );
  await page.route("**/api/users/me/dishes/*/interactions", (route) => {
    requestBody = route.request().postDataJSON();
    chosen = true;
    return route.fulfill({ json: { data: { id: "action" } } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Gợi ý cho hôm nay" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Phở bò", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/today-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Chọn món hôm nay" }).click();
  await expect(
    page.getByRole("heading", { name: "Phở bò", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Đang nghỉ 1 món")).toBeVisible();
  expect(requestBody.type).toBe("CHOSEN");
  expect(requestBody.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
  expect(errors).toEqual([]);
});
test("keeps safety and provider errors visible without fabricated restaurants", async ({
  page,
}) => {
  await page.route("**/api/recommendations/today", (route) =>
    route.fulfill({
      json: { data: { status: "INSUFFICIENT_SAFETY_DATA", items: [] } },
    }),
  );
  await page.route("**/api/dishes?q=*", (route) =>
    route.fulfill({ json: { data: { items: [dish] } } }),
  );
  await page.route("**/api/dishes/*/restaurants", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "PLACES_NOT_CONFIGURED",
          message: "Tìm quán chưa được cấu hình",
        },
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Chưa đủ dữ liệu an toàn để gợi ý" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Tên món hoặc tên gọi khác" })
    .fill("pho");
  await page.getByRole("button", { name: "Tìm món", exact: true }).click();
  await page.getByRole("button", { name: "Phở bò", exact: true }).click();
  await page.getByRole("button", { name: "Tìm quán trên Google Maps" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Tìm quán chưa được cấu hình",
  );
  await expect(
    page.getByRole("link", { name: /Xem quán & chỉ đường/ }),
  ).toHaveCount(0);
});
