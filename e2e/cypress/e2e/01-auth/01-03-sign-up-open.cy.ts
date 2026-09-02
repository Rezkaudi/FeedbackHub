import { EPHEMERAL_PASSWORD } from '../../support/fixtures/passwords';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { withEphemeralUser } from '../../support/fixtures/ephemeral-user.fixture';
import { kc } from '../../support/clients/keycloak-admin.client';
import { mailpit } from '../../support/clients/mailpit.client';
import { api } from '../../support/clients/api.client';
import { stampedEmail } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';

/**
 * The realm has `verifyEmail: true`, so every self-registration — regardless
 * of app registration policy — hits Keycloak's own VERIFY_EMAIL wall before
 * the callback ever reaches the app. This spec drives that wall for real
 * through Mailpit, then proves the "open" policy admits the person.
 */
describe('sign-up under the "open" registration policy', () => {
  withAppSettings({ registrationPolicy: 'open' }, () => {
    it('a brand-new person registers, verifies by mail, and lands on the board as an ordinary member', () => {
      const email = stampedEmail('open-signup');
      const password = EPHEMERAL_PASSWORD;

      cy.signUp({ email, password, firstName: 'Ola', lastName: 'Newcomer' });

      // Keycloak shows an interstitial: "an email has been sent...". Follow it.
      cy.mailLinkFor(email, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));

      cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));
      cy.byTestId(TID.header.userMenuTrigger, { timeout: 20_000 }).click();
      cy.byTestId(TID.header.adminBadge).should('not.exist');

      cy.request('/v1/bootstrap').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.user.role).to.eq('user');
        expect(response.body.user.displayName).to.include('Ola');
      });

      api.me.remove();
      kc.deleteUserByEmail(email);
      mailpit.purgeFor(email);
    });

    it('a new member can immediately file a request and vote, once verified', () => {
      const email = stampedEmail('open-signup-active');
      const password = EPHEMERAL_PASSWORD;

      cy.signUp({ email, password, firstName: 'Ivy', lastName: 'Immediate' });
      cy.mailLinkFor(email, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));
      cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));

      api
        .bootstrap()
        .then((boot) => {
          const category = boot.categories.find((c) => c.isActive);
          expect(category, 'an active category should exist').to.not.be.undefined;
          return api.requests.create({
            title: `A request from a brand-new member ${Date.now()}`,
            description: 'Filed the moment I signed up, to prove signup is immediately usable.',
            categoryId: category!.id,
          });
        })
        .then((request) => {
          // NestJS's default status for a bodyless @Post() is 201, and this
          // route has no @HttpCode override, despite its Swagger annotation
          // documenting 200 — 201 is the real runtime code.
          api.requests.vote(request.id).its('status').should('eq', 201);
          api.requests.remove(request.id);
        });

      api.me.remove();
      kc.deleteUserByEmail(email);
      mailpit.purgeFor(email);
    });
  });

  withEphemeralUser({ emailPrefix: 'existing-member' }, (existing) => {
    withAppSettings({ registrationPolicy: 'open' }, () => {
      it('registering with an email that already belongs to a member is refused on the Keycloak form itself', () => {
        // First, make `existing` a real member by signing them in once, then
        // sign out (a real POST with an Origin header — a bare `cy.request`
        // string shorthand defaults to GET, which this route does not serve).
        cy.signInFresh({ username: existing.email, password: existing.password });
        cy.location('origin', { timeout: 20_000 }).should('eq', Cypress.config('baseUrl'));
        cy.signOutApi();

        cy.visit('/');
        cy.origin(Cypress.env('keycloakOrigin'), { args: { email: existing.email } }, (args) => {
          cy.get('#kc-registration a', { timeout: 30_000 }).click();
          cy.get('#email', { timeout: 20_000 }).type(args.email);
          cy.get('#firstName').type('Dup');
          cy.get('#lastName').type('Licate');
          cy.get('#password').type('Another-Password1!', { log: false });
          cy.get('#password-confirm').type('Another-Password1!', { log: false });
          cy.get('#kc-form-buttons input[type="submit"]').click();
          cy.get('#input-error-email, .pf-v5-c-alert, .kc-feedback-text', { timeout: 20_000 }).should('exist');
        });
      });
    });
  });
});
