import { ADMIN, ADMIN2 } from '../../support/fixtures/accounts';
import { withEphemeralUser } from '../../support/fixtures/ephemeral-user.fixture';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { kc } from '../../support/clients/keycloak-admin.client';
import { mailpit } from '../../support/clients/mailpit.client';
import { api } from '../../support/clients/api.client';
import { stampedEmail } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';

describe('delete my account', () => {
  withEphemeralUser({ emailPrefix: 'danger-zone', signIn: false }, (user) => {
    it('cancelling the confirm dialog does nothing', () => {
      cy.signInFresh({ username: user.email, password: user.password });
      cy.location('origin', { timeout: 20_000 }).should('eq', Cypress.config('baseUrl'));
      cy.visit('/profile');
      cy.byTestId(TID.settings.dangerDelete).click();
      cy.byTestId(TID.state.confirmCancel).click();
      cy.request('/v1/me').its('status').should('eq', 200);
    });

    it('confirming deletes the account and signs the person out', () => {
      cy.signInFresh({ username: user.email, password: user.password });
      cy.location('origin', { timeout: 20_000 }).should('eq', Cypress.config('baseUrl'));
      cy.visit('/profile');
      cy.intercept('DELETE', '/v1/me').as('deleteMe');
      cy.intercept('POST', '/v1/auth/sign-out').as('signOut');
      cy.byTestId(TID.settings.dangerDelete).click();
      cy.byTestId(TID.state.confirmAccept).click();
      // Deletion also signs the browser out (Session.signOut: a POST, then a
      // full reload of "/"). What happens on screen after that reload — a
      // fresh Keycloak login form, or a silent SSO round trip that quietly
      // re-registers the same person — depends on whether that browser still
      // holds a live Keycloak SSO session, which is exactly the re-sign-up
      // scenario `01-09-re-signup.cy.ts` covers on its own terms. This test's
      // job is narrower: prove the delete-then-sign-out calls themselves
      // happen and succeed.
      cy.wait('@deleteMe').its('response.statusCode').should('eq', 204);
      cy.wait('@signOut').its('response.statusCode').should('eq', 204);
    });
  });

  withAppSettings({ registrationPolicy: 'open' }, () => {
    it("the deleted person's request and vote: the request survives, the vote does not", () => {
      const email = stampedEmail('deletable-author');
      const password = 'Sup3r-Secret-Passw0rd!';
      let requestId = '';

      kc.createUser({ email, password }).then(() => {
        cy.signInFresh({ username: email, password });
        cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));

        api
          .bootstrap()
          .then((boot) =>
            api.requests.create({
              title: `Content that outlives its author ${Date.now()}`,
              description: 'Filed just before this account is deleted.',
              categoryId: boot.categories.find((c) => c.isActive)!.id,
            }),
          )
          .then((request) => {
            requestId = request.id;
            return api.requests.vote(request.id);
          })
          .then(() => {
            cy.visit('/profile');
            cy.intercept('DELETE', '/v1/me').as('deleteMe');
            cy.byTestId(TID.settings.dangerDelete).click();
            cy.byTestId(TID.state.confirmAccept).click();
            cy.wait('@deleteMe').its('response.statusCode').should('eq', 204);

            cy.signIn(ADMIN);
            api.requests.read(requestId).then((request) => {
              expect(request.voteCount, 'the vote should be gone with its voter').to.eq(0);
              api.requests.remove(requestId);
            });
            kc.deleteUserByEmail(email);
            mailpit.purgeFor(email);
          });
      });
    });
  });

  it('last-admin: with Bo temporarily gone, Ada alone cannot leave (409)', () => {
    // Removes Bo's app record so Ada becomes the sole admin, proves the 409,
    // then restores Bo by signing them back in (implicit re-registration
    // re-creates their app row — Bo's Keycloak account is never touched).
    //
    // Re-registering always creates a plain 'user' row (there is no API route
    // to promote to admin — only the seed script sets it), so this would
    // otherwise permanently demote Bo for every spec that runs after this one.
    // We restore the role directly against Postgres afterwards — test
    // infrastructure standing in for the missing product route, not a
    // workaround for product behaviour.
    cy.signIn(ADMIN2);
    api.me.remove();

    cy.signIn(ADMIN);
    api.me.remove().its('status').should('eq', 409);

    // Re-register Bo. Kill their Keycloak SSO session first so the next
    // visit deterministically shows the login form rather than leaving it to
    // chance whether that session is still alive.
    kc.findUserByEmail(ADMIN2.username).then((kcUser) => {
      expect(kcUser, 'Bo should exist in Keycloak').to.not.be.null;
      kc.logoutUser(kcUser!.id);
    });
    Cypress.session.clearAllSavedSessions();
    cy.clearCookies();
    cy.signInFresh({ username: ADMIN2.username, password: ADMIN2.password });
    cy.byTestId(TID.header.userMenuTrigger, { timeout: 20_000 }).should('be.visible');
    cy.location('origin').should('eq', Cypress.config('baseUrl'));

    kc.findUserByEmail(ADMIN2.username).then((kcUser) => {
      cy.task('dbSetUserRole', { externalId: kcUser!.id, role: 'admin' });
    });
    Cypress.session.clearAllSavedSessions();
  });
});
