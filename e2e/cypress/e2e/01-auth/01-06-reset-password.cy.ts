import { ORIGINAL_PASSWORD, RESET_PASSWORD, USED_ONCE_PASSWORD } from '../../support/fixtures/passwords';
import { withEphemeralUser } from '../../support/fixtures/ephemeral-user.fixture';
import { mailpit } from '../../support/clients/mailpit.client';
import { kc } from '../../support/clients/keycloak-admin.client';
import { stampedEmail } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';

describe('reset password', () => {
  withEphemeralUser({ emailPrefix: 'reset' }, (user) => {
    it('forgot password -> mail -> new password -> signed in; the old password no longer works', () => {
      cy.requestPasswordReset(user.email);
      // Keycloak shows the same confirmation whether or not the address
      // exists — it never discloses account existence.
      cy.origin(Cypress.env('keycloakOrigin'), () => {
        cy.get('#kc-info, .instruction, .pf-v5-c-alert', { timeout: 20_000 }).should('exist');
      });

      const newPassword = RESET_PASSWORD;
      cy.mailLinkFor(user.email, { subjectContains: 'assword' }).then((link) => {
        cy.consumeMailLink(link);
        cy.setNewPasswordFromResetLink(newPassword);
      });

      cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));
      cy.byTestId(TID.header.userMenuTrigger, { timeout: 20_000 }).should('be.visible');

      // Sign out, and prove the OLD password is dead.
      cy.signOutApi();
      cy.visit('/');
      cy.origin(Cypress.env('keycloakOrigin'), { args: { username: user.email, password: user.password } }, (args) => {
        cy.get('#username', { timeout: 30_000 }).type(args.username);
        cy.get('#password').type(args.password, { log: false });
        cy.get('#kc-login').click();
        cy.get('#input-error-password, .pf-v5-c-alert, .kc-feedback-text', { timeout: 20_000 }).should('exist');
      });

      mailpit.purgeFor(user.email);
    });
  });

  it('requesting a reset for an unknown address gives the same confirmation and sends no mail', () => {
    const unknown = stampedEmail('never-existed');
    cy.requestPasswordReset(unknown);
    cy.origin(Cypress.env('keycloakOrigin'), () => {
      cy.get('#kc-info, .instruction, .pf-v5-c-alert', { timeout: 20_000 }).should('exist');
    });
    cy.mailExpectNone(`to:${unknown}`);
  });

  withEphemeralUser({ emailPrefix: 'forced-reset', requiredActions: ['UPDATE_PASSWORD'] }, (user) => {
    it('an UPDATE_PASSWORD required action forces the password form at next login', () => {
      cy.visit('/');
      cy.origin(
        Cypress.env('keycloakOrigin'),
        { args: { username: user.email, password: user.password } },
        (args) => {
          cy.get('#username', { timeout: 30_000 }).type(args.username);
          cy.get('#password').type(args.password, { log: false });
          cy.get('#kc-login').click();
          cy.get('#password-new', { timeout: 20_000 }).should('be.visible');
        },
      );
    });
  });

  it('a used reset link cannot be replayed', () => {
    const email = stampedEmail('single-use-reset');
    kc.createUser({ email, password: ORIGINAL_PASSWORD }).then((created) => {
      cy.requestPasswordReset(email);
      const finalPassword = USED_ONCE_PASSWORD;
      cy.mailLinkFor(email, { subjectContains: 'assword' }).then((link) => {
        cy.consumeMailLink(link);
        cy.setNewPasswordFromResetLink(finalPassword);
        cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));
        cy.signOutApi();

        cy.consumeMailLink(link, { failOnStatusCode: false });
        cy.origin(Cypress.env('keycloakOrigin'), () => {
          cy.get('body', { timeout: 20_000 }).should(($body) => {
            const text = $body.text();
            expect(/expired|invalid|no longer valid/i.test(text) || $body.find('#username').length > 0).to.eq(true);
          });
        });
      });
      kc.deleteUser(created.id);
      mailpit.purgeFor(email);
    });
  });
});
