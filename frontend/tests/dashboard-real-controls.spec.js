import { expect, test } from "@playwright/test";

async function mockDashboard(page) {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "real-controls-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "User", email: "user@example.com" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            areaLabel: "Ha Noi",
            latitude: 21.03,
            longitude: 105.79,
            budgetMax: 70000,
            maxDistanceMeters: 3500,
            allergies: [],
          },
        },
      },
    }),
  );
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({ json: { data: { status: "NO_MATCH", items: [] } } }),
  );
    await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [{ id: "12", source: "themealdb", title: "Real recipe", image: null }],
        },
      },
    }),
  );
  await page.route("**/api/discovery/nearby-food?*", (route) =>
    route.fulfill({ json: { data: { status: "SUCCESS", items: [], restaurants: [] } } }),
  );
}

test("recipe favorite button records a real backend interaction", async ({ page }) => {
  await mockDashboard(page);
  let interaction;
  await page.route("**/api/recipes/themealdb/12/interactions", (route) => {
    interaction = route.request().postDataJSON();
    return route.fulfill({ json: { data: { id: "liked-recipe", interactionType: "LIKED" } } });
  });
  await page.goto("/#today");
  await page.locator("button").filter({
    has: page.locator("span.material-symbols-outlined", { hasText: "favorite" }),
  }).click();
  await expect.poll(() => interaction?.type).toBe("LIKED");
});

test("a failed recipe source does not blank successful dish recommendations", async ({ page }) => {
  await mockDashboard(page);
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [{ id: "dish-fallback", name: "Món vẫn hiển thị" }],
        },
      },
    }),
  );
  await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({ status: 503, json: { error: { code: "RECIPE_UNAVAILABLE" } } }),
  );

  await page.goto("/#today");
  await expect(page.getByText("Món vẫn hiển thị", { exact: true })).toBeVisible();
});

test("header AI prompt is preserved when opening chat", async ({ page }) => {
  test.skip(test.info().project.name === "mobile", "The header prompt is desktop-only.");
  await mockDashboard(page);
  const conversationId = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/conversations?page=*", (route) =>
    route.fulfill({
      json: { data: { configured: true, items: [{ id: conversationId, title: "Chat" }], hasMore: false } },
    }),
  );
  await page.route(`**/api/conversations/${conversationId}`, (route) =>
    route.fulfill({ json: { data: { conversation: { id: conversationId }, messages: [], runs: [] } } }),
  );
  await page.goto("/#today");
  await page.locator("header form input").fill("Find pho near me");
  await page.locator("header form input").press("Enter");
  await expect(page).toHaveURL(/#chat$/);
  await expect(page.locator("main input")).toHaveValue("Find pho near me");
});

test("dish enters the 96-hour cooldown only after a restaurant is selected and confirmed", async ({ page }) => {
  await mockDashboard(page);
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [{ id: "dish-1", name: "Pho GPS", priceMin: 45000 }],
        },
      },
    }),
  );
  let restaurantQuery;
  await page.route("**/api/discovery/restaurants?*", (route) => {
    restaurantQuery = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [{
            source: "geoapify",
            placeId: "place-1",
            name: "Quan GPS",
            address: "Quan 1",
            distanceMeters: 500,
            latitude: 10.775,
            longitude: 106.7,
          }],
        },
      },
    });
  });
  let interaction;
  await page.route("**/api/users/me/dishes/*/interactions", (route) => {
    interaction = route.request().postDataJSON();
    return route.fulfill({ json: { data: { id: "chosen-1" } } });
  });

  await page.goto("/#today");
  await page.getByRole("button", { name: "Xem quán gần bạn cho món Pho GPS" }).click();
  await expect(page.getByText("Quan GPS", { exact: true })).toBeVisible();
  expect(restaurantQuery.get("q")).toBe("Pho GPS");
  expect(restaurantQuery.get("latitude")).toBe("21.03");
  expect(restaurantQuery.get("longitude")).toBe("105.79");
  expect(interaction).toBeUndefined();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  expect(interaction).toBeUndefined();

  await page.getByRole("button", { name: /Xem quán & chọn/ }).first().click();
  await page.getByRole("button", { name: /Quan GPS/ }).click();
  await page.getByRole("button", { name: "Chốt món này", exact: true }).click();
  await expect.poll(() => interaction?.type).toBe("CHOSEN");
});

test("main discovery requests the current meal and defers restaurants until a dish click", async ({ page }) => {
  let requestedMealPeriod;
  let restaurantRequests = 0;
  await mockDashboard(page);
  await page.route("**/api/recommendations/today?*", (route) => {
    requestedMealPeriod = new URL(route.request().url()).searchParams.get("mealPeriod");
    return route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [{ id: "dish-meal", name: "Món đúng bữa", mealPeriods: [requestedMealPeriod] }],
        },
      },
    });
  });
  await page.route("**/api/discovery/restaurants?*", (route) => {
    restaurantRequests += 1;
    return route.fulfill({ json: { data: { status: "SUCCESS", items: [] } } });
  });

  await page.goto("/#today");
  await expect(page.getByRole("heading", { name: "Món đúng bữa" })).toBeVisible();
  expect(["BREAKFAST", "LUNCH", "DINNER"]).toContain(requestedMealPeriod);
  expect(restaurantRequests).toBe(0);
  await expect(page.getByText(/Quán Ăn Quanh Đây/)).toHaveCount(0);

  await page.getByRole("button", { name: "Xem quán gần bạn cho món Món đúng bữa" }).click();
  await expect.poll(() => restaurantRequests).toBe(1);
});
