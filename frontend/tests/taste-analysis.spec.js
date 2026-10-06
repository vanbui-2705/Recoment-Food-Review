import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
  await page.route("**/api/users/me/food-knowledge", (r) =>
    r.fulfill({
      json: {
        data: {
          knowledge: { description: "Tôi dị ứng đậu phộng", revision: 2 },
        },
      },
    }),
  );
});
const initialJob = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "NEEDS_REVIEW",
  sourceRevision: 2,
  result: {
    fields: [],
    allergies: [{ code: "PEANUT", evidence: "đậu phộng" }],
    diets: [],
    dishes: [],
    questions: [],
  },
};
test("reviews safety extraction without replacing free text and confirms the exact revision", async ({
  page,
}) => {
  let job = initialJob;
  let confirmed;
  await page.route("**/api/users/me/food-knowledge/analyses", (r) =>
    r.fulfill({ json: { data: { configured: true, analysis: job } } }),
  );
  await page.route("**/api/users/me/food-knowledge/analyses/*/confirm", (r) => {
    confirmed = r.request().postDataJSON();
    job = { ...job, status: "APPLIED" };
    return r.fulfill({ json: { data: { analysis: job } } });
  });
  await page.goto("/#profile");
  await expect(
    page.getByText("Kiểm tra thông tin cần lưu ý", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Mô tả khẩu vị của bạn" }),
  ).toHaveValue("Tôi dị ứng đậu phộng");
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "Xác nhận thông tin này" }).click();
  await expect(
    page.getByText("Đã cập nhật khẩu vị từ mô tả của bạn.", { exact: true }),
  ).toBeVisible();
  expect(confirmed).toEqual({ sourceRevision: 2 });
  await expect(page.getByText("Coming soon", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("requires clarification for uncertain safety and shows missing AI honestly", async ({
  page,
}) => {
  let configured = true;
  const job = {
    ...initialJob,
    result: { ...initialJob.result, questions: ["Bạn dị ứng loại hạt nào?"] },
  };
  await page.route("**/api/users/me/food-knowledge/analyses", (r) =>
    r.fulfill({ json: { data: { configured, analysis: job } } }),
  );
  await page.goto("/#profile");
  await expect(
    page.getByText("Bạn dị ứng loại hạt nào?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận thông tin này" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sửa mô tả để làm rõ" }).click();
  await expect(
    page.getByRole("textbox", { name: "Mô tả khẩu vị của bạn" }),
  ).toBeFocused();
  configured = false;
  await page.reload();
  await expect(page.getByText(/AI chưa được kết nối/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Phân tích lại mô tả" }),
  ).toHaveCount(0);
});
