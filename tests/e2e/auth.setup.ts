import { test as setup, expect } from '@playwright/test';

const USERNAME = process.env.E2E_KC_USERNAME || '';
const PASSWORD = process.env.E2E_KC_PASSWORD || '';

/**
 * Log in once through the real Keycloak OAuth flow and persist the session so
 * the e2e specs run authenticated. This also continuously exercises the Phase 0
 * token verification on the live backend (a forged token would 401 here).
 */
setup('authenticate via Keycloak', async ({ page }) => {
  expect(USERNAME, 'E2E_KC_USERNAME must be set').not.toBe('');

  // /login shows a "Continue with Keycloak" button that redirects client-side.
  await page.goto('/login');
  await page.getByRole('button', { name: /continue with keycloak/i }).click();
  await page.waitForURL(/\/protocol\/openid-connect\/auth/, { timeout: 30_000 });

  // Standard Keycloak login form.
  await page.fill('#username', USERNAME);
  await page.fill('#password', PASSWORD);
  await page.click('#kc-login');

  // Back on the app; the callback stores the session in localStorage.
  await page.waitForURL((url) => !/\/realms\//.test(url.href), { timeout: 30_000 });
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('atlas_session')), {
      timeout: 30_000,
    })
    .not.toBeNull();

  await page.context().storageState({ path: 'tests/.auth/state.json' });
});
