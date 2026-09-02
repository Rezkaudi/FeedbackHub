import { ADMIN } from '../../support/fixtures/accounts';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

describe('admin: registration policy', () => {
  afterEach(() => {
    cy.signIn(ADMIN);
    api.settings.app.update({ registrationPolicy: 'open', allowedEmailDomains: [] });
  });

  it('switches to invite_only and back through the UI', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.intercept('PATCH', '/v1/settings/app').as('save');
    cy.byTestId(TID.admin.policy).select('invite_only');
    cy.wait('@save');
    api.settings.app.read().its('registrationPolicy').should('eq', 'invite_only');
  });

  it('switches to domain_restricted with a domain list, saved and echoed', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.byTestId(TID.admin.policy).select('domain_restricted');
    cy.byTestId(TID.admin.domains).type('example.com, team.co');
    cy.intercept('PATCH', '/v1/settings/app').as('save');
    cy.byTestId(TID.admin.domainsSave).click();
    cy.wait('@save');
    api.settings.app.read().then((settings) => {
      expect(settings.registrationPolicy).to.eq('domain_restricted');
      expect(settings.allowedEmailDomains).to.deep.equal(['example.com', 'team.co']);
    });
  });

  it('domain_restricted with an empty domain list is refused, and nothing is saved', () => {
    cy.signIn(ADMIN);
    api.settings.app.read().then((before) => {
      api.settings.app.updateRaw({ registrationPolicy: 'domain_restricted', allowedEmailDomains: [] }).its('status').should('eq', 400);
      api.settings.app.read().then((after) => {
        expect(after.registrationPolicy).to.eq(before.registrationPolicy);
      });
    });
  });

  it('the UI blocks saving an empty domain list with a visible message', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.byTestId(TID.admin.policy).select('domain_restricted');
    cy.byTestId(TID.admin.domainsError).should('be.visible');
    cy.byTestId(TID.admin.domainsSave).should('be.disabled');
  });

  it('a malformed domain shows the bad-domain message', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.byTestId(TID.admin.policy).select('domain_restricted');
    cy.byTestId(TID.admin.domains).type('not a domain!!');
    cy.byTestId(TID.admin.domainsError).should('be.visible');
  });

  it('the policy select round-trips through a reload', () => {
    cy.visitAs(ADMIN, '/admin/settings');
    cy.byTestId(TID.admin.policy).select('invite_only');
    cy.reload();
    cy.byTestId(TID.admin.policy).should('have.value', 'invite_only');
  });
});
