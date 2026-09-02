import type { Account } from '../fixtures/accounts';
import { kcLogin, kcRegister, kcForgotPassword, kcSetNewPassword } from '../flows/keycloak-browser.flows';
import { TID } from '../utils/testids';

declare global {
  namespace Cypress {
    interface Chainable {
      /** Signs in as `account`, cached per-persona via `cy.session` across
       *  specs. `validate()` requires a live `/v1/bootstrap`, so a stale or
       *  revoked session is re-driven rather than silently reused. */
      signIn(account: Account): Chainable<void>;
      /** Same login flow, but never cached — for ephemeral accounts and for
       *  asserting the flow itself (e.g. bad-password specs). */
      signInFresh(credentials: { username: string; password: string }): Chainable<void>;
      /** Drives Keycloak's hosted registration form to sign up a brand-new
       *  person. Leaves the browser wherever the outcome sends it: the board
       *  (open policy, no verify wall), a VERIFY_EMAIL page, or a refusal. */
      signUp(input: { email: string; password: string; firstName?: string; lastName?: string }): Chainable<void>;
      /** Drives the full "forgot password" flow up to and including setting
       *  the new password, assuming the reset link is already loaded (use
       *  `cy.consumeMailLink` first). */
      setNewPasswordFromResetLink(password: string): Chainable<void>;
      /** From the Keycloak login page: starts "Forgot Password?" and submits
       *  the email. Does not follow the mail link — see `mailpit.linkFor`. */
      requestPasswordReset(email: string): Chainable<void>;
      /** Visits a mail action link (verify-email / reset-password /
       *  execute-actions) inside `cy.origin`, so app assertions after it can
       *  resume on the app origin. Pass `{ failOnStatusCode: false }` for a
       *  link expected to be dead (used, expired) — Keycloak answers those
       *  with a 400 on the action-token endpoint itself, which would
       *  otherwise fail the visit before the test can assert on the page. */
      consumeMailLink(url: string, options?: { failOnStatusCode?: boolean }): Chainable<void>;
      /** Signs out via the user menu, asserts the sign-out POST succeeded. */
      signOutUi(): Chainable<void>;
      /** A real `POST /v1/auth/sign-out` with the required `Origin` header —
       *  for specs that need to end the app session without going through the
       *  UI. (A bare `cy.request('/v1/auth/sign-out')` defaults to GET, which
       *  this route does not serve, and silently leaves the session intact —
       *  always use this instead.) */
      signOutApi(): Chainable<Cypress.Response<unknown>>;
      /** Asserts the app is on `/sign-in-problem` with the given `problem`
       *  (and optional `reason`) query params. */
      expectSignInProblem(problem: string, reason?: string): Chainable<void>;
    }
  }
}

const keycloakOrigin = () => String(Cypress.env('keycloakOrigin') ?? 'http://localhost:8080');
const appOrigin = () => String(Cypress.config('baseUrl') ?? 'http://localhost:4200');

Cypress.Commands.add('signIn', (account: Account) => {
  cy.session(
    ['fh', account.username],
    () => {
      cy.visit('/');
      cy.origin(keycloakOrigin(), { args: { username: account.username, password: account.password } }, kcLogin);
      cy.location('origin', { timeout: 30_000 }).should('eq', appOrigin());
      cy.byTestId(TID.header.userMenuTrigger, { timeout: 20_000 }).should('be.visible');
    },
    {
      cacheAcrossSpecs: true,
      validate() {
        cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).then((response) => {
          expect(response.status, 'cached session still authenticates').to.eq(200);
        });
      },
    },
  );
});

Cypress.Commands.add('signInFresh', (credentials: { username: string; password: string }) => {
  cy.visit('/');
  cy.origin(keycloakOrigin(), { args: credentials }, kcLogin);
});

Cypress.Commands.add(
  'signUp',
  (input: { email: string; password: string; firstName?: string; lastName?: string }) => {
    // A brand-new person means a brand-new browser, as far as auth state
    // goes. If an earlier step in the SAME test signed someone else in (e.g.
    // an admin inviting this person before they register), both the app
    // session and Keycloak's own SSO cookie are still live — `cy.visit('/')`
    // then shows the signed-in app straight away, and even once `cy.origin`
    // gets to Keycloak, its live SSO session can silently complete a round
    // trip back to the app before the registration form ever renders,
    // leaving `cy.origin` waiting on an origin the browser already left.
    // Clearing both first guarantees the registration form is what loads.
    Cypress.session.clearAllSavedSessions();
    cy.clearCookies();
    cy.visit('/');
    cy.origin(
      keycloakOrigin(),
      {
        args: {
          email: input.email,
          password: input.password,
          firstName: input.firstName ?? 'E2E',
          lastName: input.lastName ?? 'Person',
        },
      },
      kcRegister,
    );
  },
);

Cypress.Commands.add('requestPasswordReset', (email: string) => {
  cy.visit('/');
  cy.origin(keycloakOrigin(), { args: { email } }, kcForgotPassword);
});

Cypress.Commands.add('setNewPasswordFromResetLink', (password: string) => {
  cy.origin(keycloakOrigin(), { args: { password } }, kcSetNewPassword);
});

Cypress.Commands.add('consumeMailLink', (url: string, options?: { failOnStatusCode?: boolean }) => {
  const target = new URL(url);
  const failOnStatusCode = options?.failOnStatusCode ?? true;
  if (target.origin === keycloakOrigin()) {
    cy.origin(keycloakOrigin(), { args: { url, failOnStatusCode } }, ({ url: target_, failOnStatusCode: foc }) => {
      cy.visit(target_, { failOnStatusCode: foc });
    });
  } else {
    cy.visit(url, { failOnStatusCode });
  }
});

Cypress.Commands.add('signOutUi', () => {
  cy.byTestId(TID.header.userMenuTrigger).click();
  cy.byTestId(TID.header.signOut).click();
  cy.location('origin', { timeout: 20_000 }).should('not.eq', appOrigin());
});

Cypress.Commands.add('signOutApi', () =>
  cy.request({ method: 'POST', url: '/v1/auth/sign-out', headers: { origin: appOrigin() }, failOnStatusCode: false }),
);

Cypress.Commands.add('expectSignInProblem', (problem: string, reason?: string) => {
  cy.location('pathname', { timeout: 20_000 }).should('eq', '/sign-in-problem');
  cy.location('search').should('include', `problem=${problem}`);
  if (reason) {
    cy.location('search').should('include', `reason=${reason}`);
  }
  cy.byTestId(TID.problem.heading).should('be.visible');
});
