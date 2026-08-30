import './commands';
import { ADMIN } from './accounts';
import { writeAppSettings } from './helpers';

Cypress.on('uncaught:exception', (error) => {
  const expectedBrowserErrors = [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ];

  if (expectedBrowserErrors.some((message) => error.message.includes(message))) {
    return false;
  }

  return undefined;
});

/**
 * D-44: the rate-limit windows count every request left behind by every earlier
 * run. R-130 ships 10 submissions / 100 votes / 20 sign-ups per hour, and this
 * suite files more than that across a few runs — so on a machine where it has
 * run before, tests that are not about limits start being refused with a 429.
 *
 * Lift the limits at the start of every spec (idempotent) and put the shipped
 * defaults back at the end. The three specs that are about limits set a small
 * limit of their own over a one-minute window, so the rules stay proven.
 */
// 100000 is the DTO's ceiling (@Max) on every count; over a one-minute window
// that is effectively no limit for the length of a run.
const LIFTED = {
  submissionLimitCount: 100_000,
  submissionLimitMinutes: 1,
  voteLimitCount: 100_000,
  voteLimitMinutes: 1,
  signupLimitCount: 100_000,
  signupLimitMinutes: 1,
};

const SHIPPED = {
  submissionLimitCount: 10,
  submissionLimitMinutes: 60,
  voteLimitCount: 100,
  voteLimitMinutes: 60,
  signupLimitCount: 20,
  signupLimitMinutes: 60,
};

before(() => {
  cy.signIn(ADMIN);
  writeAppSettings(LIFTED);
});

after(() => {
  cy.signIn(ADMIN);
  writeAppSettings(SHIPPED);
});
