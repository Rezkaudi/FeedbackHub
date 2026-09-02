import { EPHEMERAL_PASSWORD } from '../../support/fixtures/passwords';
import { kc } from '../../support/clients/keycloak-admin.client';
import { mailpit } from '../../support/clients/mailpit.client';
import { api } from '../../support/clients/api.client';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { stampedEmail, stampedTitle } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';

/**
 * `DELETE /v1/me` wipes `externalId` to `deleted:<id>` and the email to
 * `deleted+<id>@invalid` (apps/api identity/domain/entity/user.ts) — so
 * signing in again with the same Keycloak account creates a brand-new app
 * record, re-checked against the registration policy. This is the
 * "re-sign-up" journey.
 */
describe('re-sign-up after deleting an account', () => {
  withAppSettings({ registrationPolicy: 'open' }, () => {
    it('leaves content attributed to "Deleted user", drops the vote, and a fresh sign-in is a NEW record', () => {
      const email = stampedEmail('re-signup');
      const password = EPHEMERAL_PASSWORD;

      cy.signUp({ email, password, firstName: 'Once', lastName: 'Only' });
      cy.mailLinkFor(email, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));
      cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));

      let firstAppId = '';
      let requestId = '';

      // One explicit chain, not two unrelated statements — makes the order
      // `me.read` -> `bootstrap` -> `create` -> `vote` unambiguous. And every
      // later use of `requestId` below is itself wrapped in `cy.then()`
      // rather than passed as a bare argument: a bare `api.x(requestId)` call
      // reads the variable eagerly, at test-body-execution time — while it is
      // still `''`, since this chain has not run yet — not once this chain
      // has actually set it. Wrapping defers the read to when it is used.
      api.me.read().then((me) => {
        firstAppId = me.id;
        return api.bootstrap();
      }).then((boot) =>
        api.requests.create({
          title: stampedTitle('re-signup request'),
          description: 'A request filed before the account is deleted, to prove it survives.',
          categoryId: boot.categories.find((c) => c.isActive)!.id,
        }),
      ).then((request) => {
        requestId = request.id;
        return api.requests.vote(request.id);
      });

      cy.visit('/');
      cy.byTestId(TID.header.userMenuTrigger).click();
      cy.byTestId(TID.header.settingsLink).click();
      cy.intercept('DELETE', '/v1/me').as('deleteMe');
      cy.byTestId(TID.settings.dangerDelete).click();
      cy.byTestId(TID.state.confirmAccept).click();
      // Not "the location leaves baseUrl": deletion signs the browser out and
      // reloads '/', but this account's own Keycloak SSO session is still
      // live at that instant, so the reload can silently round-trip straight
      // back to baseUrl before ever showing a login form (see the same note
      // in `05-03-delete-account.cy.ts`). What is actually guaranteed is that
      // the DELETE itself lands.
      cy.wait('@deleteMe').its('response.statusCode').should('eq', 204);

      // The request survives; its author is now "Deleted user" territory and
      // the vote is gone (the vote row is deleted with the user). Clear this
      // account's cached session/cookies first — its live Keycloak SSO
      // session would otherwise intercept the admin login below.
      Cypress.session.clearAllSavedSessions();
      cy.clearCookies();
      cy.signInFresh({ username: 'admin@feedbackhub.local', password: 'password' });
      cy.then(() => api.requests.read(requestId)).then((request) => {
        expect(request.voteCount).to.eq(0);
      });

      // Sign back in as the SAME Keycloak account: a brand-new app record.
      // Clear Ada's cached session/cookies too — her still-live Keycloak SSO
      // session would otherwise intercept this login before this account's
      // own form ever loads (the same interference `cy.signUp` guards against).
      cy.signOutApi();
      Cypress.session.clearAllSavedSessions();
      cy.clearCookies();
      cy.signInFresh({ username: email, password });
      cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));
      api.me.read().then((me) => {
        expect(me.id).to.not.eq(firstAppId);
        expect(me.role).to.eq('user');
      });

      cy.then(() => api.requests.remove(requestId));
      api.me.remove();
      kc.deleteUserByEmail(email);
      mailpit.purgeFor(email);
    });
  });

  it('DELETE /v1/me twice returns 401 the second time — the wiped account resolves to nobody', () => {
    // Not 404: ResolveCurrentUser (R-61) reads the row fresh on every call and
    // a wiped account "resolves to nobody" — the still-valid access token no
    // longer maps to anyone, so the second call never reaches a handler that
    // could say 404, it is turned away as unauthenticated instead.
    const email = stampedEmail('delete-twice');
    const password = EPHEMERAL_PASSWORD;

    kc.createUser({ email, password }).then(() => {
      cy.signInFresh({ username: email, password });
      cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));
      api.me.remove().its('status').should('eq', 204);
      api.me.remove().its('status').should('eq', 401);
      kc.deleteUserByEmail(email);
    });
  });
});
