const base = require('./jest.base');

/**
 * Integration: repositories and database constraints against a real Postgres and
 * a real Redis, via Testcontainers. This is where "the database stops it" is
 * proved (R-158, R-145).
 */
module.exports = {
  ...base,
  displayName: 'integration',
  testMatch: [
    '<rootDir>/src/**/tests/integration/**/*.spec.ts',
    '<rootDir>/test/**/*.integration.spec.ts',
  ],
  testTimeout: 120000,
  // Point Testcontainers at a rootless podman socket when that is what is here.
  setupFiles: ['<rootDir>/test/support/container-runtime.ts'],
};
