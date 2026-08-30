import { defineConfig } from 'cypress';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:4200';
const keycloakOrigin = process.env.KEYCLOAK_ORIGIN ?? 'http://localhost:8080';

export default defineConfig({
  e2e: {
    baseUrl,
    chromeWebSecurity: true,
    video: true,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,
    experimentalMemoryManagement: true,
    retries: process.env.CI ? 0 : 0,
    defaultCommandTimeout: 10_000,
    requestTimeout: 15_000,
    responseTimeout: 20_000,
    pageLoadTimeout: 30_000,
    viewportWidth: 1440,
    viewportHeight: 900,
    testIsolation: true,
    setupNodeEvents(on, config) {
      config.env = {
        ...config.env,
        keycloakOrigin,
      };
      on('task', {
        log(message: string) {
          // eslint-disable-next-line no-console
          console.log(message);
          return null;
        },
      });
      return config;
    },
  },
});
