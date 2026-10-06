import { test, expect } from "@playwright/test";
const dishId = "882ab151-a2b4-4442-8b5d-d38774d124dc",
  restaurantId = "58f0e6e2-3727-4e1a-bc2e-ea9e34bc1eac";
const context = {
  enabled: true,
  personalizedReady: true,
  budget: 60000,
  radius: 3500,
  latitude: 10.77,
  longitude: 106.7,
  onlyOpen: false,
};
const item = {
  id: "result",
  offerId: "offer",
  dishId,
  restaurantId,
  title: "Phở thực đơn API",
  restaurantName: "Quán có nguồn",
  price: 45000,
  budgetVerified: true,
  menuConfirmed: true,
  verifiedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  distanceMeters: 200,
  photo: null,
  rating: null,
  ratingCount: null,
  reason: "Giá thực đơn còn hạn, nằm trong ngân sách của bạn",
  warnings: ["OPENING_UNCONFIRMED"],
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/recipes/today", (route) =>
    route.fulfill({ json: { data: { items: [], status: "NOT_CONFIGURED" } } }),
  );
});

test("ignores the old response when profile revision changes during automatic loading", async ({
  page,
}) => {
  let revision = 1,
    release,
    requests = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/recommendations/today", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [],
          discoveryContext: { ...context, profileRevision: revision },
        },
      },
    }),
  );
  await page.route("**/api/recommendations", async (route) => {
    requests++;
    if (requests === 1) {
      await gate;
      return route.fulfill({
        json: {
          data: {
            status: "SUCCESS",
            id: "old",
            items: [{ ...item, title: "Kết quả khẩu vị cũ" }],
            restaurants: [],
            sources: [],
            budget: 60000,
          },
        },
      });
    }
    return route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          id: "new",
          items: [{ ...item, title: "Kết quả khẩu vị mới" }],
          restaurants: [],
          sources: [],
          budget: 60000,
        },
      },
    });
  });
  await page.goto("/");
  await expect.poll(() => requests).toBe(1);
  revision = 2;
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("food-choice-saved", {
        detail: { dishId: "another-dish" },
      }),
    ),
  );
  await expect(
    page.getByRole("heading", { name: "Kết quả khẩu vị mới" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("heading", { name: "Kết quả khẩu vị cũ" }),
  ).toHaveCount(0);
});
test("loads verified offers automatically with saved context and removes choice from wheel", async ({
  page,
}) => {
  let calls = 0,
    request;
  await page.route("**/api/recommendations/today", (route) =>
    route.fulfill({
      json: {
        data: { status: "SUCCESS", items: [], discoveryContext: context },
      },
    }),
  );
  await page.route("**/api/recommendations", (route) => {
    calls++;
    request = route.request().postDataJSON();
    return route.fulfill({
      json: {
        data: {
          id: "request",
          status: "SUCCESS",
          rankingStatus: "FALLBACK_QUOTA",
          items: [item],
          sources: [],
          restaurants: [],
          budget: context.budget,
          radiusMeters: context.radius,
        },
      },
    });
  });
  await page.route("**/api/recommendations/request/feedback", (route) =>
    route.fulfill({ json: { data: { saved: true } } }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
  expect(calls).toBe(1);
  expect(request).toMatchObject({
    budget: 60000,
    radius: 3500,
    latitude: 10.77,
    longitude: 106.7,
  });
  expect(request.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
  await expect(
    page.getByText(/AI xếp hạng tạm thời chưa sẵn sàng/),
  ).toBeVisible();
  await expect(page.getByLabel("Ngân sách mỗi người (đ)")).toHaveValue("60000");
  await page.getByRole("button", { name: "Chọn món này", exact: true }).click();
  await expect(page.getByRole("heading", { name: item.title })).toHaveCount(0);
});
test("does not request GPS automatically and explains denied permission", async ({
  page,
}) => {
  let gpsRequests = 0;
  await page.exposeFunction("countGps", () => {
    gpsRequests++;
  });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_ok, error) => {
          window.countGps();
          error({ code: 1 });
        },
      },
    }),
  );
  await page.route("**/api/recommendations/today", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [],
          discoveryContext: { ...context, latitude: null, longitude: null },
        },
      },
    }),
  );
  await page.route("**/api/users/me/discovery-settings", (route) =>
    route.fulfill({ json: { data: { settings: {} } } }),
  );
  await page.route("**/api/recommendations", (route) =>
    route.fulfill({
      status: 400,
      json: { error: { code: "LOCATION_REQUIRED" } },
    }),
  );
  await page.goto("/");
  await expect(page.getByText(/App không tự xin GPS/)).toBeVisible();
  expect(gpsRequests).toBe(0);
  await page.getByRole("button", { name: "Tìm món quanh tôi" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Bạn chưa cho phép truy cập vị trí",
  );
  expect(gpsRequests).toBe(1);
});
test("persists budget separately and renders no-safe-match without relaxing constraints", async ({
  page,
}) => {
  let saved;
  await page.route("**/api/recommendations/today", (route) =>
    route.fulfill({
      json: {
        data: { status: "SUCCESS", items: [], discoveryContext: context },
      },
    }),
  );
  await page.route("**/api/recommendations", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "NO_SAFE_MATCH",
          rankingStatus: "DETERMINISTIC",
          items: [],
          sources: [],
          restaurants: [],
          budget: 30000,
        },
      },
    }),
  );
  await page.route("**/api/users/me/discovery-settings", (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { data: { settings: saved } } });
  });
  await page.goto("/");
  await expect(
    page.getByText("Chưa đủ bằng chứng cho ràng buộc ăn uống"),
  ).toBeVisible();
  await page.getByLabel("Ngân sách mỗi người (đ)").fill("30000");
  await page.getByRole("button", { name: "Tìm món quanh tôi" }).click();
  await expect(
    page.getByText("Chưa đủ bằng chứng cho ràng buộc ăn uống"),
  ).toBeVisible();
  expect(saved).toEqual({ budget: 30000, radius: 3500, onlyOpen: false });
});
