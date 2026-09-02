import './commands/index';
import { ADMIN } from './fixtures/accounts';
import { api } from './clients/api.client';
import { drainCreated } from './fixtures/entities.fixture';

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
 * D-44 lives on: the sliding-window rate limits count every request left
 * behind by every earlier run against this stack. Lift them at the start of
 * the whole run (idempotent — written unconditionally, not read-then-compared,
 * so a previously-crashed run that left small limits behind is still fixed)
 * and put the shipped defaults back at the end. The rate-limit spec
 * (`08-04-rate-limits.cy.ts`) sets its own tiny limits inside
 * `withAppSettings` and restores these LIFTED values, not the shipped ones,
 * so the rest of the run stays unaffected.
 */
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
  api.settings.app.update(LIFTED);
});

after(() => {
  cy.signIn(ADMIN);
  api.settings.app.update(SHIPPED);
});

// Every spec that created a request/comment/category/status/invitation via
// `fixtures/entities.fixture.ts` gets it cleaned up here, even if the test
// that created it failed — so one broken test cannot leave data behind for
// the next one to trip over.
afterEach(() => {
  drainCreated();
});
