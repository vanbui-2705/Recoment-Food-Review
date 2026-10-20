import { expect, test } from "@playwright/test";

async function mockSession(page) {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "live-slice-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "Live User", email: "live@example.com" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            areaLabel: "Cầu Giấy",
            budgetMax: 70000,
            maxDistanceMeters: 3500,
            latitude: 21.03,
            longitude: 105.79,
            allergies: [],
          },
        },
      },
    }),
  );
  await page.route("**/api/discovery/nearby-food?*", (route) =>
    route.fulfill({ json: { data: { status: "SUCCESS", items: [], restaurants: [] } } }),
  );
}

test("discovery renders live recommendations and sends one preference mutation", async ({ page }) => {
  await mockSession(page);
  await page.route("**/api/recommendations/today?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Món thật từ backend",
              priceMin: 45000,
              priceMax: 65000,
              score: 94,
              reason: "Phù hợp hồ sơ khẩu vị",
            },
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Món được chọn thật",
              priceMin: 50000,
              priceMax: 50000,
              score: 90,
              reason: "Ghi nhận vào lịch sử khi chọn",
            },
          ],
        },
      },
    }),
  );
    await page.route("**/api/recipes/today?*", (route) =>
    route.fulfill({ json: { data: { status: "NOT_CONFIGURED", items: [] } } }),
  );
  await page.route("**/api/discovery/restaurants?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [{
            source: "geoapify",
            placeId: "restaurant-1",
            name: "Quán liên quan thật",
            address: "Cầu Giấy",
            distanceMeters: 450,
            latitude: 21.03,
            longitude: 105.79,
          }],
        },
      },
    }),
  );
  let preferenceRequests = 0;
  let interactionRequests = 0;
  const interactionBodies = [];
  await page.route("**/api/users/me/dishes/*/preference", async (route) => {
    preferenceRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ json: { data: { saved: true } } });
  });
  await page.route("**/api/users/me/dishes/*/interactions", async (route) => {
    interactionRequests += 1;
    interactionBodies.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ json: { data: { id: "interaction-1" } } });
  });
  let refreshRequests = 0;
  let refreshBody;
  await page.route("**/api/recommendations", async (route) => {
    refreshRequests += 1;
    refreshBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              dishId: "33333333-3333-4333-8333-333333333333",
              title: "Gợi ý vừa làm mới",
              price: 60000,
              currentEligible: true,
            },
          ],
        },
      },
    });
  });

  await page.goto("/#today");
  await expect(page.getByRole("heading", { name: "Món thật từ backend" })).toBeVisible();
  await page.getByRole("button", { name: /Yêu thích: Món thật từ backend/ }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect.poll(() => preferenceRequests).toBe(1);
  await expect.poll(() => interactionBodies.filter((body) => body.type === "LIKED").length).toBe(1);

  await page.getByRole("heading", { name: "Món được chọn thật" }).click();
  await page.getByRole("button", { name: /Chọn quán Quán liên quan thật/ }).click();
  await page.getByRole("button", { name: "Chốt món này", exact: true }).click();
  await expect.poll(() => interactionBodies.filter((body) => body.type === "CHOSEN").length).toBe(1);
  const chosenBody = interactionBodies.find((body) => body.type === "CHOSEN");
  expect(chosenBody.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);

  await page.getByRole("button", { name: "Làm mới gợi ý" }).click();
  await expect(page.getByRole("heading", { name: "Gợi ý vừa làm mới" })).toBeVisible();
  expect(refreshRequests).toBe(1);
  expect(refreshBody.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
});

test("map renders nearby backend places from the saved profile", async ({ page }) => {
  await mockSession(page);
  await page.route("**/api/discovery/nearby-food?*", (route) =>
    route.fulfill({
      json: {
        data: {
          status: "SUCCESS",
          items: [
            {
              dishId: "dish-1",
              restaurantName: "Quán thật gần đây",
              title: "Phở bò",
              address: "Cầu Giấy",
              distanceMeters: 850,
              price: 55000,
              rating: 4.8,
              photo: null,
              mapsUrl: "https://maps.example/place",
            },
          ],
          restaurants: [],
        },
      },
    }),
  );

  await page.goto("/#map");
  await expect(page.getByText("Quán thật gần đây").first()).toBeVisible();
  await expect(page.getByText("Tìm thấy 1 kết quả quanh bạn")).toBeVisible();
  await expect(page.getByText("850m").first()).toBeVisible();
  await page.getByText("Quán thật gần đây").first().click();
  await expect(page.getByRole("button", { name: "×" })).toBeVisible();
});

test("map keeps missing-location and provider errors honest", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("eatwise_access_token", "map-error-token"),
  );
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ json: { data: { user: { displayName: "Map User", email: "map@example.com" } } } }),
  );
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({ json: { data: { profile: { budgetMax: 50000, maxDistanceMeters: 3500, allergies: [] } } } }),
  );
  let requestedURL;
  await page.route("**/api/discovery/nearby-food?*", (route) => {
    requestedURL = new URL(route.request().url());
    return route.fulfill({
      status: 429,
      json: { error: { code: "RATE_LIMITED", message: "Thử lại sau" } },
    });
  });

  await page.goto("/#map");
  await expect(page.getByText("Tìm thấy 0 kết quả quanh bạn")).toBeVisible();
  await expect.poll(() => requestedURL?.searchParams.get("budget")).toBe("50000");
  expect(requestedURL.searchParams.has("latitude")).toBe(false);
  expect(requestedURL.searchParams.has("longitude")).toBe(false);
  await expect(page.getByText("Bún Bò Huế O Xuân")).toHaveCount(0);
});

test("chat loads messages, sends once and consumes the SSE result", async ({ page }) => {
  await mockSession(page);
  const conversationId = "11111111-1111-4111-8111-111111111111";
  const runId = "22222222-2222-4222-8222-222222222222";
  await page.route("**/api/conversations?page=1", (route) =>
    route.fulfill({ json: { data: { configured: true, items: [{ id: conversationId }], hasMore: false } } }),
  );
  await page.route(`**/api/conversations/${conversationId}`, (route) =>
    route.fulfill({ json: { data: { conversation: { id: conversationId }, messages: [], runs: [] } } }),
  );
  let sends = 0;
  let sentBody;
  await page.route(`**/api/conversations/${conversationId}/messages`, async (route) => {
    sends += 1;
    sentBody = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ json: { data: { id: runId, status: "QUEUED" } } });
  });
  await page.route(`**/api/chat-runs/${runId}/stream?after=0`, (route) =>
    route.fulfill({
      contentType: "text/event-stream; charset=utf-8",
      body:
        `id: 1\nevent: RESULT\ndata: ${JSON.stringify({ seq: 1, type: "RESULT", payload: { text: "Phản hồi thật từ AI" } })}\n\n` +
        `id: 2\nevent: DONE\ndata: ${JSON.stringify({ seq: 2, type: "DONE", payload: { status: "COMPLETED" } })}\n\n`,
    }),
  );

  await page.goto("/#chat");
  const input = page.getByPlaceholder("Yêu cầu AI thêm quẩy giòn...");
  await input.fill("Tìm món phù hợp");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(page.getByText("Tìm món phù hợp")).toBeVisible();
  await expect(page.getByText("Phản hồi thật từ AI")).toBeVisible();
  expect(sends).toBe(1);
  expect(sentBody.text).toBe("Tìm món phù hợp");
  expect(sentBody.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
});

test("history renders backend interactions and sends feedback once", async ({ page }) => {
  await mockSession(page);
  await page.route("**/api/users/me/history?*", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              kind: "DISH",
              title: "Bún chả từ lịch sử thật",
              interactionType: "CHOSEN",
              createdAt: "2026-10-12T01:00:00.000Z",
              appRating: null,
              eligibleAgainAt: "2026-10-16T01:00:00.000Z",
            },
          ],
          nextCursor: null,
        },
      },
    }),
  );
  let feedbackRequests = 0;
  let feedbackBody;
  await page.route("**/api/users/me/history/DISH/*/feedback", async (route) => {
    feedbackRequests += 1;
    feedbackBody = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ json: { data: { id: "feedback-1", type: "LIKED" } } });
  });

  await page.goto("/#history");
  await expect(page.getByText("Bún chả từ lịch sử thật").first()).toBeVisible();
  await page.getByRole("button", { name: "Yêu thích" }).first().evaluate((button) => {
    button.click();
    button.click();
  });
  await expect.poll(() => feedbackRequests).toBe(1);
  expect(feedbackBody.type).toBe("LIKED");
  expect(feedbackBody.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
});

test("history does not present a load failure as an empty history", async ({ page }) => {
  await mockSession(page);
  await page.route("**/api/users/me/history?*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "HISTORY_UNAVAILABLE", message: "Tạm thời gián đoạn" } },
    }),
  );

  await page.goto("/#history");
  await expect(page.getByText("Không thể tải lịch sử tương tác. Vui lòng thử lại.")).toBeVisible();
  await expect(page.getByText("Chưa có tương tác phù hợp với bộ lọc này.")).toHaveCount(0);
});

test("chat resumes SSE from the last sequence without resubmitting", async ({ page }) => {
  await mockSession(page);
  const conversationId = "55555555-5555-4555-8555-555555555555";
  const runId = "66666666-6666-4666-8666-666666666666";
  await page.route("**/api/conversations?page=1", (route) =>
    route.fulfill({ json: { data: { configured: true, items: [{ id: conversationId }], hasMore: false } } }),
  );
  await page.route(`**/api/conversations/${conversationId}`, (route) =>
    route.fulfill({ json: { data: { conversation: { id: conversationId }, messages: [], runs: [] } } }),
  );
  let sends = 0;
  await page.route(`**/api/conversations/${conversationId}/messages`, (route) => {
    sends += 1;
    return route.fulfill({ json: { data: { id: runId, status: "QUEUED" } } });
  });
  const afterValues = [];
  await page.route(`**/api/chat-runs/${runId}/stream?*`, (route) => {
    const after = Number(new URL(route.request().url()).searchParams.get("after"));
    afterValues.push(after);
    return route.fulfill({
      contentType: "text/event-stream; charset=utf-8",
      body: after === 0
        ? `id: 1\nevent: RESULT\ndata: ${JSON.stringify({ seq: 1, type: "RESULT", payload: { text: "Kết quả trước khi nối lại" } })}\n\n`
        : `id: 2\nevent: DONE\ndata: ${JSON.stringify({ seq: 2, type: "DONE", payload: { status: "COMPLETED" } })}\n\n`,
    });
  });

  await page.goto("/#chat");
  await page.getByPlaceholder("Yêu cầu AI thêm quẩy giòn...").fill("Kiểm tra nối lại");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByText("Kết quả trước khi nối lại")).toBeVisible();
  await expect.poll(() => afterValues).toEqual([0, 1]);
  expect(sends).toBe(1);
});

test("chat retains input on send and stream failures", async ({ page }) => {
  await mockSession(page);
  const conversationId = "77777777-7777-4777-8777-777777777777";
  const runId = "88888888-8888-4888-8888-888888888888";
  await page.route("**/api/conversations?page=1", (route) =>
    route.fulfill({ json: { data: { configured: true, items: [{ id: conversationId }], hasMore: false } } }),
  );
  await page.route(`**/api/conversations/${conversationId}`, (route) =>
    route.fulfill({ json: { data: { conversation: { id: conversationId }, messages: [], runs: [] } } }),
  );
  let failSend = true;
  await page.route(`**/api/conversations/${conversationId}/messages`, (route) =>
    failSend
      ? route.fulfill({ status: 503, json: { error: { code: "AI_NOT_CONFIGURED", message: "AI chưa cấu hình" } } })
      : route.fulfill({ json: { data: { id: runId, status: "QUEUED" } } }),
  );
  await page.route(`**/api/chat-runs/${runId}/stream?*`, (route) =>
    route.fulfill({ status: 503, json: { error: { code: "STREAM_INTERRUPTED", message: "Mất kết nối" } } }),
  );

  await page.goto("/#chat");
  const input = page.getByPlaceholder("Yêu cầu AI thêm quẩy giòn...");
  await input.fill("Giữ nội dung khi lỗi gửi");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(input).toHaveValue("Giữ nội dung khi lỗi gửi");

  failSend = false;
  await input.fill("Giữ nội dung khi stream gián đoạn");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByText("Giữ nội dung khi stream gián đoạn")).toBeVisible();
  await expect(input).toHaveValue("Giữ nội dung khi stream gián đoạn");
});
