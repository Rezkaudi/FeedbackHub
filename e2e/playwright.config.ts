import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, run against the real stack from `docker-compose.yml`:
 * the real API, the real Postgres, the real Redis and the real Keycloak.
 * Nothing here is mocked, because the point of these tests is the wiring —
 * sign-in, cookies, authorisation and the feature switch — and a mock would
 * prove none of it (R-160).
 *
 * `BASE_URL` is the web container, not the Angular dev server. The browser must
 * see the app and the API on one origin, the way it will in production: that is
 * what makes the SameSite cookies behave (R-3h), and testing against a dev
 * server with a different proxy would test a setup nobody ships.
 */
const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './specs',
  outputDir: './.playwright/results',

  /**
   * Fails with one sentence when the stack is not up, instead of thirty — and
   * lifts the submission rate limit for the length of the run, which the
   * teardown then puts back. `rate-limits.spec.ts` explains why that does not
   * leave R-130 unproven.
   */
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',

  /**
   * These tests share one database. Two workers writing to the same board make
   * failures that depend on the order the tests happened to run, which is the
   * kind of flake that gets a suite switched off. One worker is slower and
   * honest.
   */
  workers: 1,
  fullyParallel: false,

  /**
   * No retries. A retry hides a flake, and a flake in a suite this small is a
   * real defect in the app or in the test. CI fails loudly instead.
   */
  retries: 0,
  forbidOnly: !!process.env['CI'],

  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: process.env['CI']
    ? [['github'], ['html', { outputFolder: './.playwright/report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: './.playwright/report', open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // The API refuses a request whose Origin it does not know (R-3g). The
    // browser sets this itself; saying so here keeps it true for api-only calls.
    extraHTTPHeaders: { Origin: BASE_URL },
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
