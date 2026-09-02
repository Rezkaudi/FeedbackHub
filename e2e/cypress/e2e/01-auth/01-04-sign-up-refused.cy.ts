import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { withRealmSettings } from '../../support/fixtures/realm.fixture';
import { kc } from '../../support/clients/keycloak-admin.client';
import { mailpit } from '../../support/clients/mailpit.client';
import { stampedEmail } from '../../support/utils/stamp';
import { SAM } from '../../support/fixtures/accounts';

/**
 * Every `/sign-in-problem` reason the registration rule can produce, and the
 * guarantee that a refusal never creates an app record.
 *
 * Each distinct policy configuration gets its own top-level `describe`.
 * `withAppSettings`'s before()/after() are plain Mocha hooks scoped to
 * whichever describe calls them, and Mocha runs every before() in a describe
 * before its first test — regardless of where the call sits relative to the
 * `it()`s — so two configurations sharing one describe would both apply from
 * the very start, and the second would silently overwrite the first.
 */
describe('sign-up refused: invite_only, no invitation', () => {
  withAppSettings({ registrationPolicy: 'invite_only', allowedEmailDomains: [] }, () => {
    it('refuses with reason=policy_invite_only', () => {
      const email = stampedEmail('refused-invite-only');
      cy.signUp({ email, password: 'Sup3r-Secret-Passw0rd!', firstName: 'No', lastName: 'Invite' });
      cy.mailLinkFor(email, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));
      cy.expectSignInProblem('cannot_join', 'policy_invite_only');

      cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).its('status').should('eq', 401);
      kc.deleteUserByEmail(email);
      mailpit.purgeFor(email);
    });

    it('ends the provider session: the next attempt shows a real login form again', () => {
      cy.visit('/');
      cy.origin(Cypress.env('keycloakOrigin'), () => {
        cy.get('#username', { timeout: 20_000 }).should('be.visible');
      });
    });

    it('an existing member is never re-checked against the policy: Sam still signs in fine', () => {
      cy.signIn(SAM);
      cy.request('/v1/bootstrap').its('status').should('eq', 200);
    });
  });
});

describe('sign-up refused: domain_restricted, disallowed domain', () => {
  withAppSettings({ registrationPolicy: 'domain_restricted', allowedEmailDomains: ['allowed-domain.test'] }, () => {
    it('a disallowed (but verified) domain refuses with reason=policy_domain', () => {
      const email = stampedEmail('refused-domain');
      cy.signUp({ email, password: 'Sup3r-Secret-Passw0rd!', firstName: 'Wrong', lastName: 'Domain' });
      cy.mailLinkFor(email, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));
      cy.expectSignInProblem('cannot_join', 'policy_domain');

      cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).its('status').should('eq', 401);
      kc.deleteUserByEmail(email);
      mailpit.purgeFor(email);
    });
  });
});

describe('sign-up refused: domain_restricted, unverified email', () => {
  withRealmSettings({ verifyEmail: false }, () => {
    withAppSettings({ registrationPolicy: 'domain_restricted', allowedEmailDomains: ['allowed-domain.test'] }, () => {
      it('refuses with reason=email_not_verified, even on an allowed domain', () => {
        const email = stampedEmail('refused-unverified').replace('@feedbackhub.test', '@allowed-domain.test');
        kc.createUser({ email, password: 'Sup3r-Secret-Passw0rd!', emailVerified: false }).then((user) => {
          cy.signInFresh({ username: email, password: 'Sup3r-Secret-Passw0rd!' });
          cy.expectSignInProblem('cannot_join', 'email_not_verified');
          kc.deleteUser(user.id);
        });
      });
    });
  });
});

describe('sign-up refused: signup rate limit spent', () => {
  withAppSettings({ registrationPolicy: 'open', signupLimitCount: 1, signupLimitMinutes: 1 }, () => {
    it('the second new sign-up in the window gets problem=cannot_join_yet', () => {
      // The first sign-up in this describe consumes the one slot; the second
      // must be refused. Both are ephemeral and cleaned up regardless.
      const first = stampedEmail('rate-first');
      const second = stampedEmail('rate-second');

      cy.signUp({ email: first, password: 'Sup3r-Secret-Passw0rd!', firstName: 'First', lastName: 'One' });
      cy.mailLinkFor(first, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));
      cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));

      cy.signUp({ email: second, password: 'Sup3r-Secret-Passw0rd!', firstName: 'Second', lastName: 'One' });
      cy.mailLinkFor(second, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));
      cy.expectSignInProblem('cannot_join_yet');

      kc.deleteUserByEmail(first);
      kc.deleteUserByEmail(second);
      mailpit.purgeFor(first);
      mailpit.purgeFor(second);
    });
  });
});

describe('sign-up refused: malformed callback', () => {
  it('a garbage code redirects to problem=sign_in_failed', () => {
    cy.request({
      url: '/v1/auth/callback?code=not-a-real-code&state=not-a-real-state',
      followRedirect: false,
    }).then((response) => {
      expect(response.status).to.be.oneOf([302, 303]);
      expect(response.headers.location as string).to.include('/sign-in-problem?problem=sign_in_failed');
    });
  });

  it('a missing code redirects to problem=sign_in_failed', () => {
    cy.request({ url: '/v1/auth/callback?state=whatever', followRedirect: false }).then((response) => {
      expect(response.status).to.be.oneOf([302, 303]);
      expect(response.headers.location as string).to.include('/sign-in-problem?problem=sign_in_failed');
    });
  });
});
