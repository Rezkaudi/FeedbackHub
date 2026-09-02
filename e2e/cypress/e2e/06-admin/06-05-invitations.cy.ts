import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { makeInvitation } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { stampedEmail } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';

describe('admin: invitations', () => {
  it('inviting a stamped address shows it Waiting', () => {
    const email = stampedEmail('invite-ui');
    cy.visitAs(ADMIN, '/admin/invitations');
    cy.byTestId(TID.admin.inviteEmail).type(email);
    cy.byTestId(TID.admin.inviteSubmit).click();
    cy.contains(`[data-testid="${TID.admin.invitationRow}"]`, email, { timeout: 10_000 }).should('exist');
  });

  it('inviting the same address twice shows a 409 alert', () => {
    const email = stampedEmail('invite-dup');
    makeInvitation(email);
    cy.visitAs(ADMIN, '/admin/invitations');
    cy.byTestId(TID.admin.inviteEmail).type(email);
    cy.byTestId(TID.admin.inviteSubmit).click();
    cy.byTestId(TID.admin.inviteActionError, { timeout: 10_000 }).should('be.visible');
  });

  it('inviting an existing member is 409', () => {
    cy.signIn(ADMIN);
    api.invitations.create(SAM.username).its('status').should('eq', 409);
  });

  it('withdrawing a Waiting invitation removes it', () => {
    const email = stampedEmail('withdraw-ui');
    makeInvitation(email).then((invitation) => {
      cy.visitAs(ADMIN, '/admin/invitations');
      cy.get(`[data-testid="${TID.admin.invitationRow}"][data-invitation-id="${invitation.id}"]`)
        .find(`[data-testid="${TID.admin.invitationWithdraw}"]`)
        .click();
      cy.byTestId(TID.state.confirmAccept).click();
      cy.get(`[data-invitation-id="${invitation.id}"]`, { timeout: 10_000 }).should('not.exist');
    });
  });

  it('an invalid email is refused, nothing created', () => {
    cy.signIn(ADMIN);
    api.invitations.list().then((before) => {
      api.invitations.create('not-an-email').its('status').should('eq', 400);
      api.invitations.list().then((after) => {
        expect(after.body).to.have.length(before.body.length);
      });
    });
  });

  it('non-admin gets 403 on GET/POST/DELETE invitations', () => {
    cy.signIn(SAM);
    api.invitations.list().its('status').should('eq', 403);
    api.invitations.create(stampedEmail('nope')).its('status').should('eq', 403);
    api.invitations.remove('00000000-0000-4000-8000-000000000000').its('status').should('eq', 403);
  });

  it('deleting an unknown invitation id is 404', () => {
    cy.signIn(ADMIN);
    api.invitations.remove('00000000-0000-4000-8000-000000000000').its('status').should('eq', 404);
  });
});

// A separate describe: `withAppSettings`'s before/after hooks apply to every
// `it()` in the describe they are called from (it is a plain `before()`, run
// once at the very start, not per test) — sharing a describe with the plain
// `open`-policy tests above would silently restrict every invite in this
// whole file to `allowed-domain.test`, breaking them all.
describe('admin: invitations under domain_restricted', () => {
  withAppSettings({ registrationPolicy: 'domain_restricted', allowedEmailDomains: ['allowed-domain.test'] }, () => {
    it('shows the domain-lock warning and refuses a disallowed domain with the explanatory 409', () => {
      cy.visitAs(ADMIN, '/admin/invitations');
      cy.byTestId(TID.admin.inviteDomainWarning).should('be.visible');
      cy.signIn(ADMIN);
      api.invitations.create(`blocked-${Date.now()}@blocked-domain.test`).its('status').should('eq', 409);
    });

    it('an allowed domain is accepted', () => {
      cy.signIn(ADMIN);
      api.invitations.create(`ok-${Date.now()}@allowed-domain.test`).its('status').should('eq', 201);
    });
  });
});
