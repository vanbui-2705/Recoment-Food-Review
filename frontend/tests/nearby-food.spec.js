import { test, expect } from "@playwright/test";
const item = {
  id: "menu:restaurant:dish",
  dishId: "11111111-1111-4111-8111-111111111111",
  title: "Phở bò",
  restaurantName: "Quán phở",
  address: "Quận 1",
  price: 45000,
  budgetVerified: true,
  menuConfirmed: true,
  distanceMeters: 500,
  rating: 4.6,
  ratingCount: 120,
  photo: null,
  mapsUrl: "https://www.google.com/maps/",
};
const restaurant = {
  placeId: "place1",
  source: "google",
  name: "Quán gần bạn",
  address: "Quận 1",
  distanceMeters: 800,
  rating: 4.5,
  ratingCount: 50,
  photo: null,
  openNow: true,
  price: null,
  attributions: [],
  mapsUrl: "https://www.google.com/maps/",
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/recommendations/today", (r) =>
    r.fulfill({
      json: { data: { status: "PROFILE_PENDING_ANALYSIS", items: [] } },
    }),
  );
  await page.route("**/api/recipes/today", (r) =>
    r.fulfill({
      json: { data: { status: "PROFILE_PENDING_ANALYSIS", items: [] } },
    }),
  );
});
test("finds nearby budget-matching dishes without AI, spins and records only a confirmed choice", async ({
  page,
}) => {
  let query;
  let chosen = false;
  let action;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/discovery/nearby-food?*", (r) => {
    query = new URL(r.request().url()).searchParams;
    return r.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          budget: 50000,
          items: [item],
          restaurants: [restaurant],
          sources: [],
          notice: "Đánh giá của quán",
        },
      },
    });
  });
  await page.route("**/api/users/me/dishes/*/interactions", (r) => {
    chosen = true;
    action = r.request().postDataJSON();
    return r.fulfill({ json: { data: { id: "chosen" } } });
  });
  await page.goto("/");
  await expect(page.locator(".food-wheel-trigger")).toHaveCSS(
    "position",
    "fixed",
  );
  await page
    .getByRole("button", { name: "Tìm món quanh tôi", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Phở bò", exact: true }),
  ).toBeVisible();
  expect(query.get("budget")).toBe("50000");
  expect(query.get("radius")).toBe("3500");
  await expect(page.getByText(/4.6\/5/)).toBeVisible();
  await page.getByRole("button", { name: "Mở vòng quay ăn gì" }).click();
  await page.getByRole("button", { name: "Quay chọn món" }).click();
  await expect(page.locator(".food-wheel")).toHaveCSS("border-radius", "50%");
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Phở bò" }),
  ).toBeVisible();
  expect(chosen).toBe(false);
  await page.screenshot({
    path: `test-results/nearby-wheel-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Chọn món này" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Phở bò", exact: true }),
  ).toHaveCount(0);
  expect(action.type).toBe("CHOSEN");
  expect(action.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("requires explicit permission before adding unpriced restaurants to the wheel", async ({
  page,
}) => {
  await page.route("**/api/discovery/nearby-food?*", (r) =>
    r.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          budget: 50000,
          items: [],
          restaurants: [restaurant],
          sources: [],
          notice: "Giá chưa xác nhận",
        },
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Tìm món quanh tôi", exact: true })
    .click();
  await page.getByRole("button", { name: "Mở vòng quay ăn gì" }).click();
  await expect(
    page.getByRole("dialog").getByText(/Nhập ngân sách/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng vòng quay" }).click();
  await page
    .getByRole("checkbox", {
      name: "Cho phép vòng quay chọn quán chưa có giá món",
    })
    .check();
  await page.getByRole("button", { name: "Mở vòng quay ăn gì" }).click();
  await expect(
    page.getByRole("button", { name: "Quay chọn món" }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
