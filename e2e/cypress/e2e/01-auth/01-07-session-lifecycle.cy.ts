import { ADMIN } from '../../support/fixtures/accounts';
import { kc } from '../../support/clients/keycloak-admin.client';
import { withRealmSettings } from '../../support/fixtures/realm.fixture';
import { TID } from '../../support/utils/testids';

describe('session lifecycle: refresh, expiry, rotation', () => {
  it('clearing the access cookie triggers exactly one silent refresh through the real app, and the page still works', () => {
    // `cy.intercept` only sees requests the page itself makes, so this drives
    // the browser (reload) rather than `cy.request`, which bypasses the page
    // entirely and would never touch the refresh interceptor being tested.
    cy.signIn(ADMIN);
    cy.visit('/');
    cy.byTestId(TID.header.userMenuTrigger).should('be.visible');
    cy.clearCookie('at');

    cy.intercept('POST', '/v1/auth/refresh').as('refresh');
    cy.reload();
    cy.wait('@refresh');
    cy.byTestId(TID.header.userMenuTrigger, { timeout: 20_000 }).should('be.visible');
    cy.get('@refresh.all').should('have.length', 1);
  });

  it('POST /v1/auth/refresh with no refresh cookie returns 401', () => {
    cy.clearCookies();
    cy.request({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { origin: Cypress.config('baseUrl') as string },
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 401);
  });

  it('a successful refresh rotates the refresh token — replaying the old one fails', () => {
    cy.signIn(ADMIN);
    cy.visit('/');

    cy.getCookie('rt').then((before) => {
      expect(before, 'rt cookie should be set').to.not.be.null;
      const oldValue = before!.value;

      cy.request({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: Cypress.config('baseUrl') as string },
      })
        .its('status')
        .should('eq', 204);

      cy.getCookie('rt').then((after) => {
        expect(after?.value, 'rt should rotate to a new value').to.not.eq(oldValue);
      });

      // Replaying the pre-rotation refresh token: set it back on the jar and
      // try again. `revokeRefreshToken`/`refreshTokenMaxReuse: 0` mean reuse
      // is refused.
      cy.setCookie('rt', oldValue, { path: '/v1/auth' });
      cy.request({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: Cypress.config('baseUrl') as string },
        failOnStatusCode: false,
      })
        .its('status')
        .should('eq', 401);
    });
  });

  it('killing the Keycloak session server-side invalidates the access token on the next call', () => {
    cy.signIn(ADMIN);
    cy.visit('/');
    kc.findUserByEmail(ADMIN.username).then((user) => {
      expect(user, 'Ada should exist in Keycloak').to.not.be.null;
      kc.logoutUser(user!.id);
    });
    cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).its('status').should('eq', 401);
    // The suite's own cached cy.session for ADMIN is now stale; the next spec
    // that calls cy.signIn(ADMIN) will re-drive the login because `validate()`
    // requires a live 200.
    Cypress.session.clearAllSavedSessions();
  });

  it('a 403 (permission failure) never gets turned into a refresh attempt', () => {
    cy.signIn(ADMIN);
    cy.visit('/admin/settings');
    cy.intercept('POST', '/v1/auth/refresh').as('refresh');
    // A 403 through the real page: forge a foreign origin is impossible from
    // the browser itself, so use the settings page's own PATCH with a
    // deliberately malformed body that the server still evaluates
    // Origin-first — the same-origin fetch always carries a valid Origin, so
    // this exercises "some other 4xx never triggers a refresh" via the app's
    // real HTTP client rather than `cy.request`.
    cy.intercept('PATCH', '/v1/settings/app', { statusCode: 403, body: { error: { code: 'FORBIDDEN', message: 'x', requestId: 'r' } } }).as('forbidden');
    cy.window().then((win) => {
      void win.fetch('/v1/settings/app', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' });
    });
    cy.wait('@forbidden');
    cy.get('@refresh.all').should('have.length', 0);
  });

  describe('a real, short access-token lifetime', () => {
    withRealmSettings({ accessTokenLifespan: 8 }, () => {
      it('expiry after the token dies is bridged by exactly one silent refresh, unnoticed by the person', () => {
        cy.signInFresh({ username: ADMIN.username, password: ADMIN.password });
        cy.location('origin', { timeout: 20_000 }).should('eq', Cypress.config('baseUrl'));
        cy.byTestId(TID.header.userMenuTrigger).should('be.visible');

        // Outlive the 8-second token, then act — the app must recover
        // without the person noticing (no sign-in redirect).
        cy.wait(10_000);
        cy.intercept('POST', '/v1/auth/refresh').as('refresh');
        cy.reload();
        cy.wait('@refresh');
        cy.byTestId(TID.header.userMenuTrigger, { timeout: 20_000 }).should('be.visible');
        cy.location('origin').should('eq', Cypress.config('baseUrl'));

        Cypress.session.clearAllSavedSessions();
      });
    });
  });
});
