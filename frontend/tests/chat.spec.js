import { test, expect } from "@playwright/test";
const conversationId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "test-token"),
  );
});
test("sends structured context, reconnects without resubmitting and opens recipe results", async ({
  page,
}) => {
  const messages = [],
    runs = [];
  let context = {},
    streams = 0,
    submissions = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (success) =>
          success({ coords: { latitude: 10.77, longitude: 106.7 } }),
      },
    });
  });
  await page.route("**/api/conversations?page=*", (route) =>
    route.fulfill({
      json: {
        data: {
          configured: true,
          items: [
            {
              id: conversationId,
              title: "Tìm món",
              updatedAt: new Date().toISOString(),
            },
          ],
          hasMore: false,
        },
      },
    }),
  );
  await page.route(`**/api/conversations/${conversationId}`, (route) =>
    route.fulfill({
      json: {
        data: { conversation: { id: conversationId, context }, messages, runs },
      },
    }),
  );
  await page.route(
    `**/api/conversations/${conversationId}/messages`,
    (route) => {
      const body = route.request().postDataJSON();
      submissions++;
      expect(body.context).toEqual({
        budget: 50000,
        latitude: 10.77,
        longitude: 106.7,
      });
      expect(body.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
      context = body.context;
      messages.push({ id: "user-1", role: "USER", content: body.text });
      runs.push({ id: runId, status: "RUNNING" });
      return route.fulfill({ json: { data: { id: runId, status: "QUEUED" } } });
    },
  );
  await page.route(`**/api/chat-runs/${runId}/stream?after=*`, (route) => {
    const status = `id: 1\nevent: STATUS\ndata: ${JSON.stringify({ seq: 1, type: "STATUS", payload: { status: "QUEUED" } })}\n\n`;
    if (++streams === 1)
      return route.fulfill({ contentType: "text/event-stream", body: status });
    expect(new URL(route.request().url()).searchParams.get("after")).toBe("1");
    messages.push({
      id: "assistant-1",
      role: "ASSISTANT",
      content: "Đây là công thức tìm được.",
    });
    runs[0].status = "COMPLETED";
    const result = {
      seq: 2,
      type: "RESULT",
      payload: {
        text: "Đây là công thức tìm được.",
        results: [
          {
            tool: "RECIPES",
            status: "SUCCESS",
            references: [{ kind: "RECIPE", source: "themealdb", id: "1" }],
          },
        ],
      },
    };
    const done = { seq: 3, type: "DONE", payload: { status: "COMPLETED" } };
    return route.fulfill({
      contentType: "text/event-stream",
      body:
        status +
        `id: 2\nevent: RESULT\ndata: ${JSON.stringify(result)}\n\nid: 3\nevent: DONE\ndata: ${JSON.stringify(done)}\n\n`,
    });
  });
  await page.route("**/api/recipes/themealdb/1", (route) =>
    route.fulfill({
      json: {
        data: {
          recipe: {
            id: "1",
            source: "themealdb",
            title: "Phở bò nấu tại nhà",
            ingredients: ["Bánh phở"],
            steps: ["Nấu nước dùng"],
            language: "SOURCE_ORIGINAL",
          },
        },
      },
    }),
  );
  await page.goto("/#chat");
  await page.getByRole("button", { name: /Tìm món ·/ }).click();
  await page.getByLabel("Ngân sách cho một món").fill("50000");
  await page.getByRole("button", { name: "Lấy vị trí tìm quán" }).click();
  await page.getByLabel("Bạn muốn ăn gì?").fill("Chỉ cách nấu phở bò");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(page.getByText(/Kết nối đã tạm ngắt/)).toBeVisible();
  await page.getByRole("button", { name: "Kết nối lại lượt tìm" }).click();
  await expect(
    page.getByRole("heading", { name: "Phở bò nấu tại nhà", exact: true }),
  ).toBeVisible();
  expect(submissions).toBe(1);
  await expect(page.getByLabel("Ngân sách cho một món")).toHaveValue("50000");
  await page.getByRole("link", { name: "Mở chi tiết" }).click();
  await expect(page).toHaveURL(/#recipe\/themealdb\/1$/);
  await page.getByRole("button", { name: /Quay lại/ }).click();
  await expect(
    page.getByRole("heading", { name: "Trò chuyện tìm món" }),
  ).toBeVisible();
  await expect(
    page.getByText("Chỉ cách nấu phở bò", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("shows missing AI and retains the conversation until delete succeeds", async ({
  page,
}) => {
  let attempts = 0,
    deleted = false;
  await page.route("**/api/conversations?page=*", (route) =>
    route.fulfill({
      json: {
        data: {
          configured: false,
          items: deleted
            ? []
            : [
                {
                  id: conversationId,
                  title: "Tìm món",
                  updatedAt: new Date().toISOString(),
                },
              ],
          hasMore: false,
        },
      },
    }),
  );
  await page.route(`**/api/conversations/${conversationId}`, (route) => {
    if (route.request().method() === "DELETE") {
      expect(route.request().postDataJSON()).toEqual({ confirm: true });
      if (++attempts === 1)
        return route.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE" } },
        });
      deleted = true;
      return route.fulfill({ json: { data: { deleted: true } } });
    }
    return route.fulfill({
      json: {
        data: {
          conversation: { id: conversationId, context: {} },
          messages: [],
          runs: [],
        },
      },
    });
  });
  await page.goto("/#chat");
  await expect(page.getByText(/Chat chưa được kết nối AI/)).toBeVisible();
  await page.getByRole("button", { name: /Tìm món ·/ }).click();
  await expect(
    page.getByRole("button", { name: "Gửi câu hỏi" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Xóa cuộc trò chuyện Tìm món" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Xác nhận xóa cuộc trò chuyện" })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Xác nhận xóa cuộc trò chuyện" })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Đã xóa cuộc trò chuyện.", { exact: true }),
  ).toBeVisible();
});
