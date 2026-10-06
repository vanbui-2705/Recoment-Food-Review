import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111",
  dishId = "22222222-2222-4222-8222-222222222222";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
});
test("retains a failed rating and retries with the same key before updating app stars", async ({
  page,
}) => {
  await page.route("**/api/users/me/data-reports?**", (route) =>
    route.fulfill({
      json: { data: { items: [], total: 0, page: 1, limit: 10 } },
    }),
  );
  await page.route("**/api/users/me/history?**", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id,
              kind: "DISH",
              dishId,
              title: "Phở bò",
              interactionType: "EATEN",
              createdAt: new Date().toISOString(),
              eligibleAgainAt: new Date(Date.now() + 86400000).toISOString(),
              appRating: null,
            },
          ],
          nextCursor: null,
        },
      },
    }),
  );
  let attempts = 0,
    key;
  await page.route(`**/api/users/me/history/DISH/${id}/feedback`, (route) => {
    const body = route.request().postDataJSON();
    expect(body.type).toBe("RATED");
    expect(body.rating).toBe(5);
    expect(body).not.toHaveProperty("userId");
    if (++attempts === 1) {
      key = body.idempotencyKey;
      return route.fulfill({
        status: 503,
        json: { error: { code: "SERVICE_UNAVAILABLE" } },
      });
    }
    expect(body.idempotencyKey).toBe(key);
    return route.fulfill({
      json: { data: { id: "feedback", type: "RATED", rating: 5 } },
    });
  });
  await page.goto("/#history");
  await page.getByLabel("Số sao bạn đánh giá").selectOption("5");
  await page.getByRole("button", { name: "Lưu đánh giá món" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Số sao bạn đánh giá")).toHaveValue("5");
  await expect(page.getByText(/Đã lưu đánh giá/)).toHaveCount(0);
  await page.getByRole("button", { name: "Lưu đánh giá món" }).click();
  await expect(
    page.getByText("Đánh giá của bạn trên EatWise: 5/5 sao", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Đã lưu đánh giá 5\/5/)).toBeVisible();
});
test("keeps Google venue rating separate and skips only the current suggestion pool", async ({
  page,
}) => {
  const requestId = "33333333-3333-4333-8333-333333333333";
  const context = {
    enabled: true,
    personalizedReady: true,
    budget: 50000,
    radius: 3500,
    latitude: 10.77,
    longitude: 106.7,
  };
  const item = {
    id,
    offerId: "offer",
    dishId,
    restaurantId: "venue",
    title: "Phở tại quán",
    restaurantName: "Quán phở",
    price: 40000,
    rating: 4.8,
    ratingCount: 120,
    distanceMeters: 100,
    address: "Địa chỉ",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    mapsUrl: "https://www.google.com/maps",
  };
  await page.route("**/api/recommendations/today", (route) =>
    route.fulfill({
      json: {
        data: { status: "SUCCESS", items: [], discoveryContext: context },
      },
    }),
  );
  await page.route("**/api/recipes/today", (route) =>
    route.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );
  await page.route("**/api/recommendations", (route) =>
    route.fulfill({
      json: {
        data: {
          id: requestId,
          status: "SUCCESS",
          items: [item],
          restaurants: [],
          sources: [],
          rankingStatus: "DETERMINISTIC",
        },
      },
    }),
  );
  await page.route(`**/api/recommendations/${requestId}/feedback`, (route) => {
    const body = route.request().postDataJSON();
    expect(body.type).toBe("SKIPPED");
    expect(body.resultId).toBe(id);
    expect(body).not.toHaveProperty("rating");
    return route.fulfill({
      json: { data: { id: "skip", type: "SKIPPED", rating: null } },
    });
  });
  await page.goto("/");
  await expect(page.getByText(/4.8\/5.*120 đánh giá quán/)).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Phản hồi của bạn trên EatWise" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bỏ qua món" }).click();
  await expect(
    page.getByRole("heading", { name: "Phở tại quán", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Mở vòng quay ăn gì" }).click();
  await expect(
    page.getByRole("dialog").getByText(/Nhập ngân sách và tìm quanh bạn trước/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
