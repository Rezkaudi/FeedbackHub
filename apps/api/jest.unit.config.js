const base = require('./jest.base');

/** Unit: domain and use cases with fake ports. No database, no HTTP. Fast (R-158). */
module.exports = {
  ...base,
  displayName: 'unit',
  testMatch: [
    '<rootDir>/src/modules/**/tests/unit/**/*.spec.ts',
    '<rootDir>/src/shared/**/*.spec.ts',
  ],
  testTimeout: 5000,
};
