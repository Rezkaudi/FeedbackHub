import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { TID } from '../../support/utils/testids';

describe('sign out', () => {
  it('signs out from the user menu and lands off the app origin', () => {
    cy.signIn(ADMIN);
    cy.visit('/');
    cy.signOutUi();
    cy.location('origin').should('not.eq', Cypress.config('baseUrl'));
  });

  it('after signing out, /v1/bootstrap is 401 — the session cookies no longer authenticate', () => {
    // The AUT ends up on the Keycloak origin after sign-out (it always redirects
    // there next), so this asserts through `cy.request`, which is
    // origin-independent, rather than an app-window command like
    // `cy.getCookie` — see the module doc in `support/commands/auth.commands.ts`.
    cy.signIn(ADMIN);
    cy.visit('/');
    cy.signOutUi();
    cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).its('status').should('eq', 401);
  });

  it('ends the Keycloak SSO session too: a fresh visit shows the login form, not silent SSO', () => {
    cy.signIn(ADMIN);
    cy.visit('/');
    cy.signOutUi();
    cy.visit('/');
    cy.origin(Cypress.env('keycloakOrigin'), () => {
      cy.get('#username', { timeout: 20_000 }).should('be.visible');
    });
  });

  it('POST /v1/auth/sign-out is idempotent: no cookies at all still returns 204', () => {
    cy.request({
      method: 'POST',
      url: '/v1/auth/sign-out',
      headers: { origin: Cypress.config('baseUrl') as string },
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 204);
  });

  it('POST /v1/auth/sign-out with no Origin is refused by the OriginGuard even though the route is public', () => {
    cy.request({ method: 'POST', url: '/v1/auth/sign-out', failOnStatusCode: false }).its('status').should('eq', 403);
  });

  it('signing out then in as a different persona leaves no trace of the first', () => {
    cy.signIn(ADMIN);
    cy.visit('/');
    cy.signOutUi();

    cy.signInFresh({ username: SAM.username, password: SAM.password });
    cy.byTestId(TID.header.userMenuTrigger, { timeout: 20_000 }).click();
    cy.byTestId(TID.header.adminBadge).should('not.exist');
  });
});
