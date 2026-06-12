import { test, expect } from '@playwright/test';

// Read-only smoke against production. No auth, no writes.
test('home renders', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
});

test('login page renders', async ({ page }) => {
  const res = await page.goto('/login');
  expect(res?.status()).toBe(200);
});

test('version endpoint responds', async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}/api/version`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('sha');
});

test('forged login is rejected (Phase 0)', async ({ request }) => {
  const res = await request.post('https://atlas.labmgm.org/api/v1/auth/login', {
    data: { keycloakId: 'x', email: 'x@evil.test', name: 'x', accessToken: 'not.a.jwt' },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(401);
});
