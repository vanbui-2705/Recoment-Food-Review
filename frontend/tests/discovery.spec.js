import { test, expect } from "@playwright/test";
const recipe = {
  id: "12",
  source: "themealdb",
  title: "Phở bò",
  image: null,
  cuisine: "Vietnamese",
  readyInMinutes: null,
  servings: null,
  ingredients: ["200 g Beef", "1 l Water"],
  steps: ["Prepare ingredients", "Cook soup"],
  sourceUrl: "https://example.com/recipe",
  videoUrl: null,
};
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
test("free text finds places without requiring a knowledge-bank dish and labels nearby-only sources", async ({
  page,
}) => {
  let query;
  await page.route("**/api/discovery/restaurants?*", (route) => {
    query = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          sources: [
            { source: "google", status: "UNAVAILABLE" },
            { source: "geoapify", status: "OK" },
          ],
          items: [
            {
              source: "geoapify",
              placeId: "near",
              name: "Quán gần đây",
              address: "Quận 1",
              distanceMeters: 200,
              rating: null,
              openNow: null,
              attributions: [],
              matchType: "NEARBY_RESTAURANT",
              mapsUrl: null,
              menuConfirmed: false,
            },
          ],
          notice: "Chưa xác nhận thực đơn",
        },
      },
    });
  });
  await page.goto("/#discover");
  await page
    .getByRole("textbox", { name: "Món bạn đang thèm" })
    .fill("Món chưa có trong ngân hàng");
  await page.getByRole("button", { name: "Tìm quán phù hợp" }).click();
  await expect(
    page.getByRole("heading", { name: "Quán gần đây" }),
  ).toBeVisible();
  expect(query.get("q")).toBe("Món chưa có trong ngân hàng");
  await expect(
    page.getByText("Nhà hàng gần bạn", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Chưa xác nhận quán bán món này hoặc giá món."),
  ).toBeVisible();
  await expect(
    page.getByText("Google Maps tạm thời chưa có kết quả.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("searches cooking recipes, shows ingredients and steps, and records yesterday on backend", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let interaction;
  await page.route("**/api/recipes?*", (r) =>
    r.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [recipe],
          sources: [],
          notice: "Công thức nguyên bản",
        },
      },
    }),
  );
  await page.route("**/api/recipes/themealdb/12", (r) =>
    r.fulfill({ json: { data: { recipe } } }),
  );
  await page.route("**/api/recipes/themealdb/12/interactions", (r) => {
    interaction = r.request().postDataJSON();
    return r.fulfill({ json: { data: { id: "record" } } });
  });
  await page.goto("/#discover");
  await page.getByRole("button", { name: "Nấu tại nhà", exact: true }).click();
  await page.getByRole("textbox", { name: "Món bạn đang thèm" }).fill("pho");
  await page
    .getByRole("button", { name: "Tìm công thức", exact: true })
    .click();
  await page.getByRole("button", { name: "Xem cách nấu" }).click();
  await expect(
    page.getByRole("heading", { name: "Chuẩn bị nguyên liệu" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "200 g Beef" }).check();
  await expect(page.getByText("Bước 1 / 2")).toBeVisible();
  await page.getByRole("button", { name: "Bước tiếp theo" }).click();
  await expect(page.getByText("Bước 2 / 2")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Công thức gốc" }),
  ).toHaveAttribute("href", "https://example.com/recipe");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chuẩn bị nguyên liệu" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/recipe-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Đã ăn món này hôm qua" }).click();
  await expect(
    page.getByText("Đã ghi nhận món.", { exact: false }),
  ).toBeVisible();
  expect(interaction.type).toBe("EATEN");
  expect(interaction.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
  expect(new Date(interaction.eatenAt).getTime()).toBeLessThan(Date.now());
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("shows missing-provider state and can change between cooking and restaurant search", async ({
  page,
}) => {
  await page.route("**/api/recipes?*", (r) =>
    r.fulfill({
      json: { data: { status: "NOT_CONFIGURED", items: [], sources: [] } },
    }),
  );
  await page.goto("/#discover");
  await page.getByRole("button", { name: "Nấu tại nhà", exact: true }).click();
  await page.getByRole("textbox", { name: "Món bạn đang thèm" }).fill("soup");
  await page
    .getByRole("button", { name: "Tìm công thức", exact: true })
    .click();
  await expect(
    page.getByText("Nguồn công thức đang được thiết lập.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tìm quán", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tìm quán phù hợp" }),
  ).toBeVisible();
  await expect(
    page.getByText("Nguồn công thức đang được thiết lập.", { exact: true }),
  ).toHaveCount(0);
});
