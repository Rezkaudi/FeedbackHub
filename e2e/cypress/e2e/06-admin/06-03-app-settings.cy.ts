import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { api } from '../../support/clients/api.client';
import { TID, LIMIT_FIELD } from '../../support/utils/testids';

describe('admin: application settings', () => {
  afterEach(() => {
    cy.signIn(ADMIN);
    api.settings.app.update({
      commentsRequireApproval: false,
      featureCommentsEnabled: true,
      submissionLimitCount: 100_000,
      submissionLimitMinutes: 1,
      voteLimitCount: 100_000,
      voteLimitMinutes: 1,
      signupLimitCount: 100_000,
      signupLimitMinutes: 1,
    });
  });

  it('the page loads current settings into every control', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.byTestId(TID.admin.policy).should('have.value', 'open');
  });

  it('toggling comments-enabled persists and changes bootstrap.features', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.intercept('PATCH', '/v1/settings/app').as('save');
    cy.byTestId(TID.admin.commentsEnabled).uncheck({ force: true });
    cy.wait('@save');
    api.settings.app.read().its('featureCommentsEnabled').should('eq', false);
    api.bootstrap().its('features.commentsEnabled').should('eq', false);
  });

  it('toggling require-approval persists', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.intercept('PATCH', '/v1/settings/app').as('save');
    cy.byTestId(TID.admin.commentsApproval).check({ force: true });
    cy.wait('@save');
    api.settings.app.read().its('commentsRequireApproval').should('eq', true);
  });

  it('editing a rate-limit field persists', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.intercept('PATCH', '/v1/settings/app').as('save');
    cy.byTestId(`settings-limit-${LIMIT_FIELD.submissionCount}`).clear().type('7').blur();
    cy.wait('@save');
    api.settings.app.read().its('submissionLimitCount').should('eq', 7);
  });

  it('a limit count below 1 is refused', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.byTestId(`settings-limit-${LIMIT_FIELD.voteCount}`).clear().type('0').blur();
    cy.byTestId(TID.admin.limitError).should('be.visible');
  });

  it('a count above the API ceiling is refused', () => {
    cy.signIn(ADMIN);
    api.settings.app.updateRaw({ submissionLimitCount: 1_000_000 }).its('status').should('eq', 400);
  });

  it('an unknown body field is 400', () => {
    cy.signIn(ADMIN);
    api.settings.app.updateRaw({ bogus: true }).its('status').should('eq', 400);
  });

  it('a non-admin cannot GET or PATCH settings/app', () => {
    cy.signIn(SAM);
    api.settings.app.readRaw().its('status').should('eq', 403);
    api.settings.app.updateRaw({ featureCommentsEnabled: false }).its('status').should('eq', 403);
  });

  it('changes survive a reload', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.byTestId(TID.admin.commentsEnabled).uncheck({ force: true });
    cy.reload();
    cy.byTestId(TID.admin.commentsEnabled).should('not.be.checked');
  });
});
