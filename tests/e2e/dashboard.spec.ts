import { test, expect } from '@playwright/test';

// Runs with the stored Keycloak session (see auth.setup.ts).
test('authenticated user reaches the dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  // Not bounced back to /login (session is valid).
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page.locator('body')).toBeVisible();
});

test('feature flags endpoint is reachable and returns an object', async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}/api/version`);
  expect(res.ok()).toBeTruthy();
});
