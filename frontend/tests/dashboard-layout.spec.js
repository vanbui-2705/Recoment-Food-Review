import { expect, test } from "@playwright/test";

const routes = ["today", "chat", "map", "profile", "history"];

for (const route of routes) {
  test(`${route} keeps the approved dashboard shell`, async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("eatwise_access_token", "layout-token"),
    );
    await page.route("**/api/users/me", (request) =>
      request.fulfill({ json: { data: { user: { displayName: "Layout User", email: "layout@example.com" } } } }),
    );
    await page.route("**/api/users/me/profile", (request) =>
      request.fulfill({ json: { data: { profile: { allergies: [] } } } }),
    );
    await page.route(/\/api\/catalogs\/(allergens|dietary-restrictions|cuisines)$/, (request) =>
      request.fulfill({ json: { data: { items: [] } } }),
    );
    await page.route("**/api/recommendations/today?*", (request) =>
      request.fulfill({ json: { data: { status: "NO_MATCH", items: [] } } }),
    );
    await page.route("**/api/recipes/today?*", (request) =>
      request.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
    );
    await page.route("**/api/conversations?page=1", (request) =>
      request.fulfill({ json: { data: { configured: false, items: [], hasMore: false } } }),
    );
    await page.route("**/api/conversations", (request) =>
      request.fulfill({ status: 201, json: { data: { id: "11111111-1111-4111-8111-111111111111" } } }),
    );
    await page.route("**/api/conversations/11111111-1111-4111-8111-111111111111", (request) =>
      request.fulfill({ json: { data: { conversation: {}, messages: [], runs: [] } } }),
    );
    await page.route("**/api/discovery/nearby-food?*", (request) =>
      request.fulfill({ json: { data: { status: "NO_MATCH", items: [], restaurants: [] } } }),
    );
    await page.route("**/api/users/me/history?*", (request) =>
      request.fulfill({ json: { data: { items: [], nextCursor: null } } }),
    );
    await page.goto(`/#${route}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("nav:visible").first()).toBeVisible();

    const layout = await page.evaluate(() => {
      const main = document.querySelector("main")?.getBoundingClientRect();
      const visibleNavs = [...document.querySelectorAll("nav")].filter(
        (element) => getComputedStyle(element).display !== "none",
      );

      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        mainWidth: main?.width ?? 0,
        mainHeight: main?.height ?? 0,
        visibleNavs: visibleNavs.length,
      };
    });

    expect(layout.overflow).toBe(false);
    expect(layout.mainWidth).toBeGreaterThan(0);
    expect(layout.mainHeight).toBeGreaterThan(0);
    expect(layout.visibleNavs).toBeGreaterThan(0);
  });
}
