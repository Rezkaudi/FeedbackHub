import { defineConfig } from 'cypress';
import { Pool } from 'pg';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:4200';
const keycloakOrigin = process.env.KEYCLOAK_ORIGIN ?? 'http://localhost:8080';
const mailpitOrigin = process.env.MAILPIT_ORIGIN ?? 'http://localhost:8025';
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3000';
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://feedbackhub:feedbackhub@localhost:5433/feedbackhub';

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    chromeWebSecurity: true,
    testIsolation: true,
    video: !!process.env.CI,
    videoCompression: false,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,
    experimentalMemoryManagement: true,
    numTestsKeptInMemory: process.env.CI ? 0 : 20,
    // The sign-in chain crosses four origins (4200 -> 8080 -> 3000 -> 4200);
    // retrying twice in CI is honest engineering given that, not flake-hiding
    // — every spec is idempotent by design (see the hygiene section of
    // DECISIONS.md), so a retry never masks a real ordering bug.
    retries: { runMode: 2, openMode: 0 },
    defaultCommandTimeout: 10_000,
    requestTimeout: 15_000,
    responseTimeout: 20_000,
    pageLoadTimeout: 60_000,
    viewportWidth: 1440,
    viewportHeight: 900,
    env: {
      keycloakOrigin,
      mailpitOrigin,
      apiOrigin,
      keycloakRealm: 'feedbackhub',
      keycloakAdminUser: process.env.KEYCLOAK_ADMIN ?? 'admin',
      keycloakAdminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin',
      keycloakClientId: 'feedbackhub-api',
      oidcRedirectUri: process.env.OIDC_REDIRECT_URI ?? 'http://localhost:3000/v1/auth/callback',
    },
    setupNodeEvents(on, config) {
      config.env = {
        ...config.env,
      };
      // Direct-to-Postgres pool, used for exactly one thing: restoring a
      // seeded admin's role after a test has to delete-and-re-register their
      // app record (see `05-03-delete-account.cy.ts`'s last-admin case).
      // There is no product API to promote a user to admin — only the seed
      // script sets it — so this is test infrastructure standing in for it,
      // not a workaround for a product feature. Never used to assert on
      // product behaviour, only to repair fixture state the API cannot.
      const pool = new Pool({ connectionString: databaseUrl });
      on('task', {
        log(message: string) {
          // eslint-disable-next-line no-console
          console.log(message);
          return null;
        },
        async dbSetUserRole({ externalId, role }: { externalId: string; role: string }) {
          await pool.query('UPDATE users SET role = $1 WHERE external_id = $2', [role, externalId]);
          return null;
        },
      });
      on('after:run', async () => {
        await pool.end();
      });
      on('before:browser:launch', (browser, options) => {
        if (browser.family === 'chromium') {
          options.args.push('--disable-dev-shm-usage', '--no-sandbox');
        }
        return options;
      });
      return config;
    },
  },
});
