import { defineConfig, devices } from '@playwright/test';

// Two projects:
//  - smoke: read-only checks against any BASE_URL (defaults to prod). No auth.
//  - e2e:   authenticated flows against staging; `setup` logs in once via the
//           real Keycloak flow and saves the storage state the e2e specs reuse.
const E2E_BASE = process.env.E2E_BASE_URL || 'https://atlas-staging.labmgm.org';
const SMOKE_BASE = process.env.SMOKE_BASE_URL || 'https://atlas.labmgm.org';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'on-first-retry', actionTimeout: 15_000 },
  projects: [
    {
      name: 'smoke',
      testMatch: /tests\/smoke\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: SMOKE_BASE },
    },
    {
      name: 'setup',
      testMatch: /tests\/e2e\/auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: E2E_BASE },
    },
    {
      name: 'e2e',
      testMatch: /tests\/e2e\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: E2E_BASE,
        storageState: 'tests/.auth/state.json',
      },
    },
  ],
});
