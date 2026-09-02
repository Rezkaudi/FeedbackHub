import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { api, apiGet } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

const ADMIN_ROUTES = ['/admin', '/admin/categories', '/admin/statuses', '/admin/settings', '/admin/invitations'];

describe('admin: access control surface', () => {
  it('Sam navigating to every admin route lands on /not-allowed', () => {
    cy.signIn(SAM);
    for (const route of ADMIN_ROUTES) {
      cy.visit(route);
      cy.location('pathname', { timeout: 10_000 }).should('eq', '/not-allowed');
    }
  });

  it('the user menu shows no admin entry for Sam, and does for Ada', () => {
    cy.visitAs(SAM, '/');
    cy.byTestId(TID.header.userMenuTrigger).click();
    cy.byTestId(TID.header.adminLink).should('not.exist');

    cy.visitAs(ADMIN, '/');
    cy.byTestId(TID.header.userMenuTrigger).click();
    cy.byTestId(TID.header.adminLink).should('exist');
  });

  it('the full admin API surface is 403 for Sam and OK for Ada', () => {
    cy.signIn(SAM);
    apiGet('/taxonomy', { failOnStatusCode: false }).its('status').should('eq', 403);
    api.settings.app.readRaw().its('status').should('eq', 403);
    api.invitations.list().its('status').should('eq', 403);
    api.comments.pending().its('status').should('eq', 403);

    cy.signIn(ADMIN);
    apiGet('/taxonomy', { failOnStatusCode: false }).its('status').should('eq', 200);
    api.settings.app.readRaw().its('status').should('eq', 200);
    api.invitations.list().its('status').should('eq', 200);
    api.comments.pending().its('status').should('eq', 200);
  });

  it('/not-allowed is itself behind authGuard', () => {
    cy.visit('/not-allowed');
    cy.origin(Cypress.env('keycloakOrigin'), () => {
      cy.get('#username', { timeout: 20_000 }).should('be.visible');
    });
  });
});
