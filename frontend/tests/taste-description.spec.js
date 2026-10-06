import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
});
test("edits free text, persists its revision and restores after reload without catalog forms", async ({
  page,
}) => {
  let saved = null;
  let body;
  await page.route("**/api/users/me/food-knowledge", (route) => {
    if (route.request().method() === "PUT") {
      body = route.request().postDataJSON();
      saved = {
        description: body.description,
        revision: (saved?.revision || 0) + 1,
        analysisStatus: "NOT_ANALYZED",
      };
    }
    return route.fulfill({ json: { data: { knowledge: saved } } });
  });
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
  await page.goto("/#profile");
  await expect(
    page.getByRole("textbox", { name: "Mô tả khẩu vị của bạn" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Mô tả khẩu vị của bạn" })
    .fill(
      "Tôi thích món Việt, ít cay. Dị ứng đậu phộng.\nKhông thích hành sống.",
    );
  await page.screenshot({
    path: `test-results/taste-description-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lưu mô tả khẩu vị" }).click();
  await expect(
    page.getByRole("heading", { name: "Đã lưu khẩu vị của bạn" }),
  ).toBeVisible();
  expect(body).toEqual({
    description:
      "Tôi thích món Việt, ít cay. Dị ứng đậu phộng.\nKhông thích hành sống.",
    expectedRevision: 0,
  });
  await page
    .getByRole("button", { name: "Khẩu vị của tôi", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Mô tả khẩu vị của bạn" }),
  ).toHaveValue(saved.description);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("retains unsaved input and blocks overwriting a newer revision", async ({
  page,
}) => {
  await page.route("**/api/users/me/food-knowledge", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            data: { knowledge: { description: "Khẩu vị đã lưu", revision: 1 } },
          },
        })
      : route.fulfill({
          status: 409,
          json: {
            error: {
              code: "FOOD_KNOWLEDGE_CONFLICT",
              message: "Mô tả đã được cập nhật ở nơi khác.",
            },
          },
        }),
  );
  await page.goto("/#profile");
  await page
    .getByRole("textbox", { name: "Mô tả khẩu vị của bạn" })
    .fill("Bản đang viết của tôi");
  await page.getByRole("button", { name: "Lưu mô tả khẩu vị" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Mô tả khẩu vị của bạn" }),
  ).toHaveValue("Bản đang viết của tôi");
  await expect(
    page.getByRole("button", { name: "Lưu mô tả khẩu vị" }),
  ).toBeDisabled();
});
