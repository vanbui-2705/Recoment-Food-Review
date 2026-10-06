import { test, expect } from "@playwright/test";
const row = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "DISH",
  title: "Phở bò",
  interactionType: "CHOSEN",
  createdAt: new Date().toISOString(),
  eligibleAgainAt: new Date(Date.now() + 86400000).toISOString(),
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
});
test("paginates and filters history, previews cooldown and preserves a failed deletion", async ({
  page,
}) => {
  let deleted = false,
    attempts = 0;
  await page.route("**/api/users/me/history?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        data: {
          items:
            deleted || params.get("kind") === "RECIPE"
              ? []
              : params.has("cursor")
                ? [
                    {
                      ...row,
                      id: "22222222-2222-4222-8222-222222222222",
                      title: "Bún bò",
                    },
                  ]
                : [row],
          nextCursor:
            !deleted && !params.has("cursor") && !params.get("kind")
              ? "next-page"
              : null,
        },
      },
    });
  });
  await page.route("**/api/users/me/history/DISH/*/deletion-preview", (route) =>
    route.fulfill({
      json: {
        data: {
          ...row,
          expectedVersion: "a".repeat(64),
          eligibleAgainAtAfterDeletion: row.eligibleAgainAt,
          notice: "Lần chọn hoặc ăn khác vẫn giữ thời gian chờ cho món này.",
        },
      },
    }),
  );
  await page.route("**/api/users/me/history/DISH/*", (route) => {
    expect(route.request().postDataJSON()).toEqual({
      confirm: true,
      expectedVersion: "a".repeat(64),
    });
    if (++attempts === 1)
      return route.fulfill({
        status: 503,
        json: { error: { code: "SERVICE_UNAVAILABLE" } },
      });
    deleted = true;
    return route.fulfill({ json: { data: { deleted: true } } });
  });
  await page.goto("/#history");
  await expect(
    page.getByRole("heading", { name: "Phở bò", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem thêm nhật ký" }).click();
  await expect(
    page.getByRole("heading", { name: "Bún bò", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xóa bản ghi Phở bò" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Lần chọn hoặc ăn khác/)).toBeVisible();
  await dialog.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Phở bò", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Đã xóa bản ghi");
  await page.getByLabel("Nguồn món").selectOption("RECIPE");
  await expect(page.getByText(/Chưa có bản ghi phù hợp/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("shows loading failure and retries without a false empty state", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/users/me/history?**", (route) =>
    ++calls === 1
      ? route.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE" } },
        })
      : route.fulfill({ json: { data: { items: [row], nextCursor: null } } }),
  );
  await page.goto("/#history");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText(/Chưa có bản ghi phù hợp/)).toHaveCount(0);
  await page.getByRole("button", { name: "Thử tải lại" }).click();
  await expect(
    page.getByRole("heading", { name: "Phở bò", exact: true }),
  ).toBeVisible();
});
