const base = require('./jest.base');

/**
 * API: Supertest against the running Nest app with a real database. The guard
 * chain, the one error shape, the status codes (R-158, R-157).
 */
module.exports = {
  ...base,
  displayName: 'api',
  testMatch: ['<rootDir>/src/**/tests/api/**/*.spec.ts'],
  testTimeout: 120000,
  // Point Testcontainers at a rootless podman socket when that is what is here.
  setupFiles: ['<rootDir>/test/support/container-runtime.ts'],
};
