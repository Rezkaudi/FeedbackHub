import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { SEED } from '../../support/fixtures/seed-ids';
import { TID } from '../../support/utils/testids';

const PROTECTED_ROUTES = ['/', '/requests/new', `/requests/${SEED.requests.darkMode}`, '/profile'];
const ADMIN_ROUTES = ['/admin', '/admin/categories', '/admin/statuses', '/admin/settings', '/admin/invitations'];

describe('route guards and deep links', () => {
  for (const route of PROTECTED_ROUTES) {
    it(`${route} redirects an anonymous visitor to Keycloak`, () => {
      cy.visit(route);
      cy.origin(Cypress.env('keycloakOrigin'), () => {
        cy.get('#username', { timeout: 30_000 }).should('be.visible');
      });
    });
  }

  it('/sign-in-problem is reachable while signed out', () => {
    cy.visit('/sign-in-problem?problem=cannot_join&reason=policy_invite_only');
    cy.byTestId(TID.problem.heading).should('be.visible');
  });

  for (const route of ADMIN_ROUTES) {
    it(`${route} sends a non-admin to /not-allowed`, () => {
      cy.signIn(SAM);
      cy.visit(route);
      cy.location('pathname', { timeout: 20_000 }).should('eq', '/not-allowed');
    });

    it(`${route} renders for an admin`, () => {
      cy.signIn(ADMIN);
      cy.visit(route);
      cy.location('pathname', { timeout: 20_000 }).should('not.eq', '/not-allowed');
    });
  }

  it('an unknown route renders NotFound', () => {
    cy.signIn(ADMIN);
    cy.visit('/this-route-does-not-exist');
    cy.location('pathname').should('eq', '/this-route-does-not-exist');
    cy.get('h1').should('exist');
  });

  it('a non-UUID request id is handled without a blank screen', () => {
    cy.signIn(ADMIN);
    cy.visit('/requests/not-a-real-uuid');
    cy.get('h1, [role="alert"]', { timeout: 15_000 }).should('exist');
  });

  it('reload keeps an admin on an admin page', () => {
    cy.signIn(ADMIN);
    cy.visit('/admin/settings');
    cy.reload();
    cy.location('pathname').should('eq', '/admin/settings');
  });
});
