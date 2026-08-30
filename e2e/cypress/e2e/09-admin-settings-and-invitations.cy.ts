import { ADMIN, SAM } from '../support/accounts';
import { readAppSettings, stamp, writeAppSettings } from '../support/helpers';

describe('Administration: application settings and invitations', () => {
  beforeEach(() => cy.signIn(ADMIN));

  it('updates a submission limit and reflects it without restart', () => {
    readAppSettings().then((before) => {
      // A small, always-valid value — the suite's rate-limit lift can leave the
      // stored count at the DTO ceiling, so `+ 1` would be refused.
      const next = 7;
      cy.visit('/admin/settings');
      cy.get('input#submissionLimitCount').clear().type(String(next)).blur();
      cy.contains(/in use straight away/i).should('be.visible');
      cy.reload();
      cy.get('input#submissionLimitCount').should('have.value', String(next));
      writeAppSettings({
        submissionLimitCount: before.submissionLimitCount,
        submissionLimitMinutes: before.submissionLimitMinutes,
      });
    });
  });

  it('rejects a zero rate limit in the UI', () => {
    cy.visit('/admin/settings');
    cy.get('input#voteLimitCount').clear().type('0').blur();
    cy.contains(/at least 1/i).should('be.visible');
  });

  it('supports invite-only registration', () => {
    readAppSettings().then((before) => {
      writeAppSettings({ registrationPolicy: 'invite_only' });
      cy.visit('/admin/settings');
      cy.get('select#policy').should('have.value', 'invite_only');
      cy.visit('/admin/invitations');
      cy.get('input#invite-email').should('be.visible');
      writeAppSettings({ registrationPolicy: before.registrationPolicy });
    });
  });

  it('creates and cancels an invitation', () => {
    const email = `invite-${stamp()}@example.com`;
    cy.visit('/admin/invitations');
    cy.get('input#invite-email').type(email);
    cy.contains('button', /send invitation/i).click();
    cy.contains('td', email).should('be.visible');
    cy.get(`button[aria-label="Withdraw the invitation for ${email}"]`).click();
    cy.contains('td', email).should('not.exist');
  });

  it('blocks invitations for an ordinary user', () => {
    cy.signIn(SAM);
    cy.apiGet('/invitations', false).its('status').should('eq', 403);
    cy.apiPost('/invitations', { email: `blocked-${stamp()}@example.com` }, false)
      .its('status')
      .should('eq', 403);
  });
});
