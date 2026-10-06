import { test, expect } from "@playwright/test";
test("refreshes today automatically after the pending analysis applies", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  let applied = false;
  let allowApply = false;
  let reads = 0;
  let recommendations = 0;
  await page.route("**/api/recommendations/today", (r) => {
    recommendations++;
    return r.fulfill({
      json: {
        data: {
          status: applied ? "NO_MATCH" : "PROFILE_PENDING_ANALYSIS",
          items: [],
        },
      },
    });
  });
  await page.route("**/api/recipes/today", (r) =>
    r.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );
  await page.route("**/api/users/me/food-knowledge/analyses", (r) => {
    reads++;
    applied = allowApply;
    return r.fulfill({
      json: {
        data: {
          configured: true,
          analysis: {
            id: "11111111-1111-4111-8111-111111111111",
            sourceRevision: 1,
            status: applied ? "APPLIED" : "RUNNING",
            result: null,
          },
        },
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByText("Đang đọc mô tả của bạn…", { exact: true }),
  ).toBeVisible();
  allowApply = true;
  await expect
    .poll(() => recommendations, { timeout: 15000 })
    .toBeGreaterThan(1);
  await expect(
    page.getByText("Đang đọc mô tả của bạn…", { exact: true }),
  ).toHaveCount(0);
});
