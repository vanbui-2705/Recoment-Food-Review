import { expect, test } from '@playwright/test';

test('dashboard loads account, profile and recommendations from the API', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('eatwise_access_token', 'dashboard-test-token'),
  );

  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      json: {
        data: {
          user: {
            id: 'user-1',
            email: 'live@example.com',
            displayName: 'Tài khoản thật',
            role: 'USER',
          },
        },
      },
    }),
  );
  await page.route('**/api/users/me/profile', (route) =>
    route.fulfill({
      json: {
        data: {
          profile: {
            allergies: [{ code: 'SHELLFISH', severity: 'SEVERE' }],
          },
        },
      },
    }),
  );
  await page.route('**/api/recommendations/today?*', (route) =>
    route.fulfill({
      json: {
        data: {
          status: 'SUCCESS',
          items: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              name: 'Phở bò từ backend',
              description: 'Dữ liệu gợi ý thật từ API.',
              cuisine: { name: 'Việt Nam' },
              priceMin: 45000,
              priceMax: 65000,
            },
          ],
        },
      },
    }),
  );
  await page.route('**/api/recipes/today?*', (route) =>
    route.fulfill({ json: { data: { status: 'NOT_CONFIGURED', items: [] } } }),
  );

  let interaction;
  await page.route('**/api/users/me/dishes/*/interactions', (route) => {
    interaction = route.request().postDataJSON();
    return route.fulfill({ json: { data: { id: 'interaction-1' } } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Đồng bộ lại/ }).click();
  await expect(page.getByText('Tài khoản thật')).toBeVisible();
  await expect(page.getByText('live@example.com')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Phở bò từ backend' })).toBeVisible();
  await expect(page.getByText(/45\.000.*65\.000/)).toBeVisible();

  await page.getByRole('button', { name: 'Chọn món hôm nay' }).click();
  await expect.poll(() => interaction?.type).toBe('CHOSEN');
  expect(interaction.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
});

test('sidebar changes between live feature pages', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem('eatwise_access_token', 'navigation-test-token'),
  );
  await page.route('**/api/users/me', (route) =>
    route.fulfill({ json: { data: { user: { email: 'nav@example.com', displayName: 'Nav User' } } } }),
  );
  await page.route('**/api/users/me/profile', (route) =>
    route.fulfill({ json: { data: { profile: { allergies: [] } } } }),
  );
  await page.route('**/api/recommendations/today?*', (route) =>
    route.fulfill({ json: { data: { status: 'NO_MATCH', items: [] } } }),
  );
  await page.route('**/api/recipes/today?*', (route) =>
    route.fulfill({ json: { data: { status: 'NOT_CONFIGURED', items: [] } } }),
  );
  await page.route('**/api/users/me/food-knowledge', (route) =>
    route.fulfill({ json: { data: { knowledge: null } } }),
  );
  await page.route('**/api/users/me/history?*', (route) =>
    route.fulfill({ json: { data: { items: [], nextCursor: null } } }),
  );
  await page.route('**/api/users/me/data-reports?*', (route) =>
    route.fulfill({ json: { data: { items: [], page: 1, pages: 1 } } }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: /Hồ sơ vị giác$/i }).click();
  await expect(page.getByRole('heading', { name: 'Khẩu vị của tôi' })).toBeVisible();
  await expect(page).toHaveURL(/#profile$/);

  await page.getByRole('button', { name: /Lịch sử$/ }).click();
  await expect(page.getByRole('heading', { name: 'Đã chọn / đã ăn' })).toBeVisible();
  await expect(page).toHaveURL(/#history$/);

  await page.getByRole('button', { name: /Khám phá$/ }).click();
  await expect(page).toHaveURL(/#today$/);
  expect(errors).toEqual([]);
});
