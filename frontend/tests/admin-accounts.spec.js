import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("eatwise_access_token", "admin-test-token");
  });

  // Mock admin user
  await page.route("**/api/users/me", (route) =>
    route.fulfill({
      json: {
        data: {
          user: {
            id: "admin-uuid-1",
            displayName: "Super Admin",
            email: "admin@eatwise.vn",
            role: "ADMIN",
          },
        },
      },
    }),
  );

  // Mock profile
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            areaLabel: "TP. Hồ Chí Minh",
            allergies: [],
          },
        },
      },
    }),
  );

  // Mock admin stats
  await page.route("**/api/admin/users/stats", (route) =>
    route.fulfill({
      json: {
        data: {
          total: 10,
          active: 9,
          disabled: 1,
          admins: 2,
          users: 8,
        },
      },
    }),
  );

  // Mock admin user list
  await page.route("**/api/admin/users?*", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id: "admin-uuid-1",
              email: "admin@eatwise.vn",
              displayName: "Super Admin",
              role: "ADMIN",
              status: "ACTIVE",
              createdAt: "2026-03-01T08:00:00Z",
              updatedAt: "2026-03-01T08:00:00Z",
            },
            {
              id: "user-uuid-2",
              email: "khachhang@eatwise.vn",
              displayName: "Nguyễn Văn A",
              role: "USER",
              status: "ACTIVE",
              createdAt: "2026-03-05T10:00:00Z",
              updatedAt: "2026-03-05T10:00:00Z",
            },
            {
              id: "user-uuid-3",
              email: "spammer@bad.com",
              displayName: "Tài Khoản Spam",
              role: "USER",
              status: "DISABLED",
              createdAt: "2026-03-10T12:00:00Z",
              updatedAt: "2026-03-10T12:00:00Z",
            },
          ],
          page: 1,
          pageSize: 10,
          total: 3,
        },
      },
    }),
  );

  // Mock admin audit logs
  await page.route("**/api/admin/audit?*", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id: "audit-1",
              action: "USER_STATUS_UPDATE",
              targetId: "user-uuid-3",
              actorId: "admin-uuid-1",
              createdAt: "2026-03-11T09:00:00Z",
              metadata: { nextStatus: "DISABLED" },
            },
          ],
        },
      },
    }),
  );
});

test("admin accounts page displays metrics, user list, and role actions", async ({
  page,
}) => {
  await page.goto("/#admin-users");

  // Check Heading and Metric Cards
  await expect(page.getByRole("heading", { name: "Quản Lý Tài Khoản Người Dùng" })).toBeVisible();
  await expect(page.getByText("Tổng tài khoản")).toBeVisible();
  await expect(page.getByText("Đang hoạt động")).toBeVisible();
  await expect(page.getByText("Đang bị khóa")).toBeVisible();
  await expect(page.getByText("Quản trị viên", { exact: true })).toBeVisible();

  // Check Table Rows
  const table = page.getByRole("table");
  await expect(table.getByText("admin@eatwise.vn")).toBeVisible();
  await expect(table.getByText("khachhang@eatwise.vn")).toBeVisible();
  await expect(table.getByText("spammer@bad.com")).toBeVisible();

  // Check that self badge is rendered
  await expect(table.getByText("Bạn", { exact: true })).toBeVisible();

  // Check search bar
  const searchInput = page.getByPlaceholder("Tìm theo email hoặc tên người dùng...");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("khachhang");

  // Screenshot for artifacts
  await page.screenshot({
    path: "test-results/admin-accounts.png",
    fullPage: true,
  });
});
