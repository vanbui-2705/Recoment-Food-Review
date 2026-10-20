import { expect, test } from "@playwright/test";

const catalog = [
  {
    id: "dish-no-image",
    name: "Món chưa có ảnh",
    score: 99,
  },
  {
    id: "dish-budget",
    name: "Bánh mì thịt",
    imageUrl: "/images/dishes/banh-mi-thit.jpg",
    imageAttribution: "Open image",
    priceMin: 20000,
    priceMax: 60000,
    score: 94,
  },
  {
    id: "dish-everyday",
    name: "Phở bò",
    imageUrl: "/images/dishes/pho-bo.jpg",
    priceMin: 40000,
    priceMax: 90000,
    score: 92,
  },
  {
    id: "dish-premium",
    name: "Bò lúc lắc",
    imageUrl: "/images/dishes/bo-luc-lac.jpg",
    priceMin: 140000,
    priceMax: 280000,
    score: 90,
  },
  {
    id: "dish-special",
    name: "Sushi set đặc biệt",
    imageUrl: "/images/dishes/sushi-set.jpg",
    priceMin: 280000,
    priceMax: 480000,
    score: 88,
  },
];

async function mockLiveDashboard(page) {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "rich-food-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "Food User" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            areaLabel: "TP. Hồ Chí Minh",
            latitude: 10.77,
            longitude: 106.7,
            budgetMax: 500000,
            maxDistanceMeters: 3500,
            allergies: [],
          },
        },
      },
    }),
  );
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({ json: { data: { status: "SUCCESS", items: catalog } } }),
  );
  await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [
            {
              id: "recipe-1",
              source: "themealdb",
              title: "Recipe inspiration",
              image: "https://example.test/recipe.jpg",
            },
          ],
        },
      },
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockLiveDashboard(page);
});

test("renders image-backed catalog dishes before recipe inspiration across price bands", async ({
  page,
}) => {
  await page.goto("/#today");

  await expect(page.locator("h2")).toHaveText("Bánh mì thịt");
  await expect(page.getByRole("img", { name: "Bánh mì thịt" })).toBeVisible();
  await expect(page.getByText("Bình dân", { exact: true })).toBeVisible();
  await expect(page.getByText("Hằng ngày", { exact: true })).toBeVisible();
  await expect(page.getByText("Cao cấp", { exact: true })).toBeVisible();
  await expect(page.getByText("Dịp đặc biệt", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Chưa có ảnh cho Món chưa có ảnh" }),
  ).toBeVisible();

  const catalogHeading = page.getByRole("heading", { name: /Món hợp gu của bạn/ });
  const inspirationHeading = page.getByRole("heading", { name: /Cảm hứng nấu ăn/ });
  await expect(catalogHeading).toBeVisible();
  await expect(inspirationHeading).toBeVisible();
  expect(
    await catalogHeading.evaluate((node) =>
      Boolean(node.compareDocumentPosition(document.querySelector("[data-recipe-inspiration]")) & Node.DOCUMENT_POSITION_FOLLOWING),
    ),
  ).toBe(true);
});

test("date venue action searches with saved location and never records a chosen dish", async ({
  page,
}) => {
  let restaurantQuery;
  let chosenRequests = 0;
  await page.route("**/api/discovery/restaurants?*", (route) => {
    restaurantQuery = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [
            {
              source: "geoapify",
              placeId: "date-place",
              name: "Rooftop Date Place",
              address: "Quận 1",
              distanceMeters: 800,
            },
          ],
        },
      },
    });
  });
  await page.route("**/api/users/me/dishes/*/interactions", (route) => {
    if (route.request().postDataJSON()?.type === "CHOSEN") chosenRequests += 1;
    return route.fulfill({ json: { data: { id: "unexpected" } } });
  });

  await page.goto("/#today");
  await page.getByRole("button", { name: "Tìm quán đi date" }).click();
  await expect(page.getByRole("heading", { name: /Quán phù hợp để đi date/ })).toBeVisible();
  await expect(page.getByText("Rooftop Date Place", { exact: true })).toBeVisible();
  expect(restaurantQuery.get("q")).toContain("đi date");
  expect(restaurantQuery.get("latitude")).toBe("10.77");
  expect(restaurantQuery.get("longitude")).toBe("106.7");
  expect(chosenRequests).toBe(0);
});

test("selecting a dish and restaurant exposes real delivery-platform handoff", async ({
  page,
}) => {
  let chosenBody;
  await page.addInitScript(() => {
    window.open = (url) => {
      window.__eatwiseOpenedUrl = String(url);
      return null;
    };
  });
  await page.route("**/api/discovery/restaurants?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [
            {
              source: "geoapify",
              placeId: "banh-mi-place",
              name: "Bánh Mì Cô Ba",
              address: "Quận 1",
              distanceMeters: 650,
              mapsUrl: "https://maps.example/banh-mi",
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/users/me/dishes/*/interactions", (route) => {
    chosenBody = route.request().postDataJSON();
    return route.fulfill({ json: { data: { id: "chosen-interaction" } } });
  });

  await page.goto("/#today");
  await page.getByRole("button", { name: "Xem quán gần bạn cho món Bánh mì thịt" }).click();
  await page.getByRole("button", { name: "Chọn quán Bánh Mì Cô Ba" }).click();
  await page.getByRole("button", { name: "Chốt món này" }).click();

  await expect(page.getByRole("dialog", { name: "Chọn cách đặt món" })).toBeVisible();
  await expect(page.getByText("Bánh Mì Cô Ba", { exact: true })).toBeVisible();
  expect(chosenBody?.type).toBe("CHOSEN");

  await page.getByRole("button", { name: "Mở ShopeeFood" }).click();
  await expect.poll(() => page.evaluate(() => window.__eatwiseOpenedUrl)).toBe("https://shopeefood.vn/");
});
