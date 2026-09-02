/**
 * `cy.origin` callbacks that drive Keycloak's hosted pages.
 *
 * DISCIPLINE: `cy.origin` serialises each callback with `Function.prototype
 * .toString()` and re-evaluates it inside the secondary origin's spec bridge.
 * That means every function here must be a TOP-LEVEL ARROW FUNCTION with a
 * SINGLE `args` PARAMETER AND ZERO FREE VARIABLES — no imported symbols, no
 * closures over outer scope, no `async`/`await` (TypeScript's `__awaiter`
 * helper is not in scope on the other side). Everything comes in through
 * `args`, which must be JSON-serialisable. Only Cypress globals and the DOM
 * are available inside the body.
 *
 * Selectors are structural (`#username`, `#kc-login`, …), confirmed against
 * the live Keycloak 26 theme rendered by this stack — never English text
 * matching, so a theme wording change cannot break the suite.
 */

export interface LoginArgs {
  username: string;
  password: string;
}

export interface RegisterArgs {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Fills the Keycloak login form (`#kc-form-login`) and submits. */
export const kcLogin = (args: LoginArgs): void => {
  cy.get('#username', { timeout: 30_000 }).should('be.visible').clear().type(args.username);
  cy.get('#password', { timeout: 20_000 }).should('be.visible').clear().type(args.password, { log: false });
  cy.get('#kc-login').should('be.visible').click();
};

/** From the login page: clicks "Register", fills the sign-up form
 *  (`#kc-register-form`), submits. Leaves the browser wherever Keycloak sends
 *  it next — the VERIFY_EMAIL wall, an error, or the app. */
export const kcRegister = (args: RegisterArgs): void => {
  cy.get('#kc-registration a', { timeout: 30_000 }).click();
  cy.get('#email', { timeout: 20_000 }).should('be.visible').clear().type(args.email);
  cy.get('#firstName').clear().type(args.firstName);
  cy.get('#lastName').clear().type(args.lastName);
  cy.get('#password').clear().type(args.password, { log: false });
  cy.get('#password-confirm').clear().type(args.password, { log: false });
  cy.get('#kc-form-buttons input[type="submit"]').click();
};

/** From the login page: clicks "Forgot Password?", enters the email, submits
 *  — Keycloak shows the same confirmation whether or not the address exists,
 *  by design, so this never discloses account existence. */
export const kcForgotPassword = (args: { email: string }): void => {
  cy.get('a[href*="reset-credentials"]', { timeout: 30_000 }).click();
  // The login page also has a `#username` field. Clicking the link above is a
  // real, server-rendered navigation (not an SPA transition), and `cy.get`
  // can resolve against the LOGIN page's element a moment before the new
  // page swaps it out from under `.clear()`. Waiting for the URL to actually
  // change first means the `#username` this queries for is unambiguously the
  // reset-credentials page's own.
  cy.location('href', { timeout: 20_000 }).should('include', 'reset-credentials');
  cy.get('#username', { timeout: 20_000 }).should('be.visible').clear().type(args.email);
  cy.get('#kc-form-buttons').click();
};

/** On an "update password" action-token page: sets a new password and
 *  submits. Used both for a forced UPDATE_PASSWORD required action and for
 *  the tail end of the forgot-password flow. */
export const kcSetNewPassword = (args: { password: string }): void => {
  cy.get('#password-new', { timeout: 20_000 }).should('be.visible').clear().type(args.password, { log: false });
  cy.get('#password-confirm').clear().type(args.password, { log: false });
  cy.get('button[type="submit"], input[type="submit"]').first().click();
};

/** On an "email verified" / "you may close this window" interstitial. Some
 *  themes show a "Continue" / "Back to Application" link; click it if present,
 *  otherwise this is a terminal page and there is nothing to do. */
export const kcContinueIfOffered = (): void => {
  cy.get('body').then(($body) => {
    const link = $body.find('a[href*="/v1/auth"], a.pf-m-primary, #landingSecondaryButton');
    if (link.length > 0) {
      cy.wrap(link.first()).click();
    }
  });
};

/** Asserts a Keycloak form/field error is visible matching `pattern` (a
 *  case-insensitive regex source) — covers both PatternFly alert and inline
 *  field-error markup used across the theme's pages. */
export const kcExpectFormError = (args: { pattern: string }): void => {
  const re = new RegExp(args.pattern, 'i');
  cy.get('.pf-v5-c-alert, .kc-feedback-text, span.pf-v5-c-form__helper-text, .instruction')
    .should(($els) => {
      const text = $els
        .toArray()
        .map((el) => el.textContent ?? '')
        .join(' ');
      expect(re.test(text), `expected one of the form messages to match ${re}`).to.eq(true);
    });
};

/** The Google identity-provider button on the login page. Asserts it exists
 *  and (optionally) clicks it — the realm's Google IdP has empty credentials,
 *  so clicking is expected to fail on Keycloak's own side, never crash the
 *  app. See `01-08-google-idp.cy.ts` and the "known gaps" table in SCOPE.md. */
export const kcGoogleButton = (args: { click: boolean }): void => {
  cy.get('#social-google', { timeout: 20_000 }).should('exist').should('have.attr', 'href').and('include', '/broker/google/');
  if (args.click) {
    cy.get('#social-google').click();
  }
};
