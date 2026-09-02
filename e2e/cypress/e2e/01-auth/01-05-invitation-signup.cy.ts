import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { makeInvitation } from '../../support/fixtures/entities.fixture';
import { kc } from '../../support/clients/keycloak-admin.client';
import { mailpit } from '../../support/clients/mailpit.client';
import { api } from '../../support/clients/api.client';
import { stampedEmail } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';
import { ADMIN } from '../../support/fixtures/accounts';

describe('invitations let a person past invite_only', () => {
  withAppSettings({ registrationPolicy: 'invite_only', allowedEmailDomains: [] }, () => {
    it('an admin invites an address; it appears Waiting; the invitee registers and is admitted', () => {
      const email = stampedEmail('invited');

      cy.signIn(ADMIN);
      cy.visit('/admin/invitations');
      cy.byTestId(TID.admin.inviteEmail).type(email);
      cy.byTestId(TID.admin.inviteSubmit).click();
      cy.byTestIdFor(TID.admin.invitationRow, {}, { timeout: 10_000 })
        .contains(email)
        .should('exist');

      cy.mailLinkFor(email, { subjectContains: 'invited' }).then((link) => {
        expect(link).to.include('/v1/auth/sign-in');
      });

      cy.signUp({ email, password: 'Sup3r-Secret-Passw0rd!', firstName: 'Invi', lastName: 'Ted' });
      cy.mailLinkFor(email, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));
      cy.location('origin', { timeout: 30_000 }).should('eq', Cypress.config('baseUrl'));
      cy.byTestId(TID.header.userMenuTrigger).should('be.visible');

      // The browser is now signed in as the invitee, not Ada — /v1/invitations
      // is admin-only, so listing it here needs Ada's session back first.
      cy.signIn(ADMIN);
      api.invitations.list().then((response) => {
        const row = response.body.find((i) => i.email === email);
        expect(row?.acceptedAt, 'invitation should now show accepted').to.not.eq(null);
      });

      cy.signIn(ADMIN);
      cy.visit('/admin/invitations');
      cy.contains(`[data-testid="${TID.admin.invitationRow}"]`, email, { timeout: 10_000 })
        .find(`[data-testid="${TID.admin.invitationWithdraw}"]`)
        .should('not.exist');

      // Clean up as the invited person themself, not as Ada — `api.me.remove()`
      // deletes whoever is currently signed in, and the last `cy.signIn` above
      // was Ada's. Removing Ada's own account here would be catastrophic and
      // silent (see the last-admin note in `05-03-delete-account.cy.ts`).
      // Clear Ada's cached session and cookies first — otherwise her still-live
      // Keycloak SSO session intercepts the login before the invitee's form
      // ever loads (the same interference `cy.signUp` guards against).
      Cypress.session.clearAllSavedSessions();
      cy.clearCookies();
      cy.signInFresh({ username: email, password: 'Sup3r-Secret-Passw0rd!' });
      api.me.remove();
      kc.deleteUserByEmail(email);
      mailpit.purgeFor(email);
    });

    it('inviting the same address twice is refused with a 409', () => {
      const email = stampedEmail('double-invite');
      makeInvitation(email);
      api.invitations.create(email).its('status').should('eq', 409);
    });

    it('inviting an address that already belongs to a member is refused with a 409', () => {
      cy.signIn(ADMIN);
      api.invitations.create('sam@feedbackhub.local').its('status').should('eq', 409);
    });

    it('withdrawing a Waiting invitation removes it, and that address is then refused', () => {
      const email = stampedEmail('withdrawn');
      makeInvitation(email).then((invitation) => {
        api.invitations.remove(invitation.id).its('status').should('eq', 204);
      });

      cy.signUp({ email, password: 'Sup3r-Secret-Passw0rd!', firstName: 'With', lastName: 'Drawn' });
      cy.mailLinkFor(email, { subjectContains: 'Verify' }).then((link) => cy.consumeMailLink(link));
      cy.expectSignInProblem('cannot_join', 'policy_invite_only');

      kc.deleteUserByEmail(email);
      mailpit.purgeFor(email);
    });
  });
});
