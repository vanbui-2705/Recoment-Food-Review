import { test, expect } from "@playwright/test";
const id = "f4453477-865e-4122-8f7e-b1f070677718";
const offerId = "72815d44-68fb-4285-beb9-958290137c78";
const supplier = {
  id,
  code: "contract-source",
  name: "Nguồn đã cấp quyền",
  enabled: true,
  maxEvidenceAgeHours: 24,
};
const result = {
  restaurant: {
    id,
    name: "Quán thực đơn thật",
    address: "Quận 1",
    rating: null,
    ratingCount: null,
    openingHours: [],
    phone: null,
    openNow: null,
    businessStatus: "UNKNOWN",
    mapsUrl: "https://www.google.com/maps/",
    updatedAt: new Date().toISOString(),
    attributions: [],
    mediaKind: "VENUE",
  },
  menu: {
    status: "AVAILABLE",
    nextCursor: null,
    items: [
      {
        id: offerId,
        dishId: null,
        title: "Phở bò",
        optionLabel: "Tô lớn",
        price: 60000,
        fresh: true,
        isAvailable: true,
        safety: "UNCONFIRMED",
        warnings: ["MAPPING_PENDING"],
        source: "Nguồn đã cấp quyền",
        sourceUrl: "https://example.org/menu",
        observedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
  },
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/recommendations/today", (route) =>
    route.fulfill({ json: { data: { status: "NO_MATCH", items: [] } } }),
  );
  await page.route("**/api/recipes/today", (route) =>
    route.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );
});
test("restaurant menu survives refresh and distinguishes unconfirmed or expired prices", async ({
  page,
}) => {
  await page.route(`**/api/restaurants/${id}?*`, (route) =>
    route.fulfill({ json: { data: result } }),
  );
  await page.goto(`/#restaurant/local/${id}`);
  await expect(
    page.getByRole("heading", { name: "Quán thực đơn thật" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Phở bò/ })).toBeVisible();
  await expect(
    page.getByText(/Chưa.*(xác minh|xác nhận|đủ bằng chứng)/).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Quán thực đơn thật" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.unroute(`**/api/restaurants/${id}?*`);
  await page.route(`**/api/restaurants/${id}?*`, (route) =>
    route.fulfill({
      json: {
        data: {
          ...result,
          menu: {
            ...result.menu,
            items: [
              {
                ...result.menu.items[0],
                price: null,
                fresh: false,
                warnings: ["PRICE_EXPIRED"],
              },
            ],
          },
        },
      },
    }),
  );
  await page.reload();
  await expect(
    page
      .getByText(/Giá.*hết hạn|Chưa có giá.*|Giá chưa.*|Cần xác nhận.*giá/)
      .first(),
  ).toBeVisible();
});
test("provider missing menu and failure retry render actionable notices", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/restaurants/places/google/place_1?*", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { error: { code: "PLACES_NOT_CONFIGURED" } },
        })
      : route.fulfill({
          json: {
            data: {
              ...result,
              menu: { items: [], status: "NO_MENU", nextCursor: null },
            },
          },
        }),
  );
  await page.goto("/#restaurant/place/google/place_1");
  await expect(page.getByRole("alert")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: /Thử lại/ }).click();
  await expect(
    page.getByText(/Chưa có thực đơn|chưa cung cấp thực đơn/).first(),
  ).toBeVisible();
});
test("admin preview is read-only until confirmed and interrupted commit can retry same snapshot", async ({
  page,
}) => {
  const calls = [];
  let interrupted = true;
  await page.route("**/api/catalogs/*", (route) =>
    route.fulfill({ json: { data: { items: [] } } }),
  );
  await page.route("**/api/admin/menu/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { data: { items: path.endsWith("suppliers") ? [supplier] : [] } },
      });
    calls.push(path);
    if (path.endsWith("preview"))
      return route.fulfill({
        json: {
          data: {
            items: [{ valid: true, title: "Phở bò", price: 60000, dishId: id }],
          },
        },
      });
    if (path.endsWith("sync-runs"))
      return route.fulfill({ json: { data: { run: { id: offerId } } } });
    if (path.endsWith("commit") && interrupted) {
      interrupted = false;
      return route.fulfill({
        status: 503,
        json: { error: { code: "SERVICE_UNAVAILABLE" } },
      });
    }
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto("/#admin");
  await page.getByLabel("Nguồn được cấp quyền").selectOption(id);
  await page
    .getByLabel("Nội dung snapshot")
    .fill(
      JSON.stringify({
        snapshotId: "unique-snapshot",
        mode: "DELTA",
        observedAt: new Date().toISOString(),
        pages: [[{}]],
      }),
    );
  await page
    .getByRole("button", { name: "Xem trước, chưa ghi dữ liệu" })
    .click();
  await expect(page.getByRole("cell", { name: "Phở bò" })).toBeVisible();
  expect(calls).toEqual(["/api/admin/menu/preview"]);
  await expect(
    page.getByRole("button", { name: "Áp dụng snapshot" }),
  ).toBeDisabled();
  await page
    .getByLabel("Tôi đã kiểm tra phạm vi snapshot, nguồn và dữ liệu xem trước.")
    .check();
  await page.getByRole("button", { name: "Áp dụng snapshot" }).click();
  await expect(page.getByRole("alert")).toContainText("Có thể thử lại");
  await page.getByRole("button", { name: "Áp dụng snapshot" }).click();
  await expect(
    page.getByText(
      "Đã áp dụng snapshot. Nhập lại cùng snapshot không tạo món trùng.",
    ),
  ).toBeVisible();
  expect(calls.filter((path) => path.endsWith("commit"))).toHaveLength(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("admin access denial displays a notice without write forms", async ({
  page,
}) => {
  await page.route("**/api/admin/menu/**", (route) =>
    route.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } }),
  );
  await page.route("**/api/catalogs/*", (route) =>
    route.fulfill({ json: { data: { items: [] } } }),
  );
  await page.goto("/#admin");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng ký nguồn" })).toHaveCount(
    0,
  );
});

test("admin reviews mapping and evidence with stale-write protection", async ({ page }) => {
  const evidence = { id: "evidence-id", kind: "ALLERGEN", code: "MILK", claim: "ABSENT", status: "PENDING", sourceUrl: "https://example.org/ingredients", excerpt: "Nguồn xác nhận không dùng sữa cho lựa chọn này", expiresAt: new Date(Date.now() + 3600000).toISOString(), reviews: [] };
  const offer = { id: offerId, title: "Phở bò", price: 60000, active: true, isAvailable: true, updatedAt: new Date().toISOString(), expiresAt: evidence.expiresAt, sourceUrl: "https://example.org/menu", identity: { restaurant: { name: "Quán thật" }, supplier }, dishId: null, dish: null, evidence: [evidence] };
  let review, mapping;
  await page.route("**/api/catalogs/*", (route) => route.fulfill({ json: { data: { items: [{ code: "MILK", name: "Sữa" }] } } }));
  await page.route("**/api/dishes?*", (route) => route.fulfill({ json: { data: { items: [{ id, name: "Phở bò chuẩn" }] } } }));
  await page.route("**/api/admin/menu/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET") return route.fulfill({ json: { data: { items: path.endsWith("offers") ? [offer] : path.endsWith("suppliers") ? [supplier] : [] } } });
    if (path.endsWith("mapping")) { mapping = route.request().postDataJSON(); offer.dishId = id; offer.dish = { id, name: "Phở bò chuẩn" }; }
    if (path.endsWith("review")) { review = route.request().postDataJSON(); evidence.status = review.status; evidence.reviews.push({ id: "review", status: review.status, reason: review.reason, createdAt: new Date().toISOString() }); }
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto("/#admin");
  await page.getByLabel("Tìm món chuẩn").fill("Phở bò");
  await page.getByRole("button", { name: "Tìm tên món" }).click();
  await page.getByLabel("Liên kết món chuẩn").selectOption(id);
  await page.getByRole("button", { name: "Lưu liên kết" }).click();
  await expect(page.getByText("Đã cập nhật liên kết món chuẩn.")).toBeVisible();
  expect(mapping).toEqual({ dishId: id, expectedUpdatedAt: offer.updatedAt });
  await page.getByText("Bằng chứng dị ứng và chế độ ăn (1)", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Duyệt bằng chứng" })).toBeDisabled();
  await page.getByLabel("Lý do duyệt hoặc thu hồi").fill("Đã kiểm tra tài liệu nhà cung cấp");
  await page.getByRole("button", { name: "Duyệt bằng chứng" }).click();
  await expect(page.getByText("Đã duyệt bằng chứng.", { exact: true })).toBeVisible();
  expect(review).toEqual({ status: "APPROVED", expectedStatus: "PENDING", reason: "Đã kiểm tra tài liệu nhà cung cấp" });
});
