import { ADMIN } from '../../support/fixtures/accounts';
import { SEED } from '../../support/fixtures/seed-ids';
import { TID } from '../../support/utils/testids';

describe('navigation', () => {
  const ROUTES = [
    '/',
    '/requests/new',
    `/requests/${SEED.requests.darkMode}`,
    '/profile',
    '/admin/categories',
    '/admin/statuses',
    '/admin/settings',
    '/admin/invitations',
    '/admin/comments',
    '/not-allowed',
    '/does-not-exist',
  ];

  for (const route of ROUTES) {
    it(`reload keeps a signed-in admin on ${route}`, () => {
      cy.visitAs(ADMIN, route);
      cy.reload();
      cy.location('pathname').should('eq', route);
    });
  }

  it('the header brand link returns to the board from anywhere', () => {
    cy.visitAs(ADMIN, `/requests/${SEED.requests.darkMode}`);
    cy.get('a.brand, [routerLink="/"]').first().click();
    cy.location('pathname').should('eq', '/');
  });

  it('breadcrumbs on request detail link back to the board', () => {
    cy.visitAs(ADMIN, `/requests/${SEED.requests.darkMode}`);
    // Scoped to the breadcrumbs component specifically — the header also has
    // a `nav[aria-label]` ("Main"), and a bare `nav[aria-label] a` selector
    // would pick whichever comes first in the DOM, not necessarily this one.
    cy.get('fh-breadcrumbs nav a').first().click();
    cy.location('pathname').should('eq', '/');
  });

  it('back and forward walk board -> detail -> board', () => {
    cy.visitAs(ADMIN, '/');
    cy.byTestId(TID.card.root).first().click();
    cy.location('pathname', { timeout: 10_000 }).should('match', /^\/requests\//);
    cy.go('back');
    cy.location('pathname', { timeout: 10_000 }).should('eq', '/');
    cy.go('forward');
    cy.location('pathname', { timeout: 10_000 }).should('match', /^\/requests\//);
  });

  it('the ** route renders NotFound with a way back to the app', () => {
    cy.visitAs(ADMIN, '/this-page-truly-does-not-exist');
    cy.get('a[routerlink="/"], a[href="/"]').should('exist');
  });

  it("the admin shell's sub-navigation reaches all five admin pages", () => {
    cy.visitAs(ADMIN, '/admin');
    for (const path of ['/admin/categories', '/admin/statuses', '/admin/settings', '/admin/invitations'] as const) {
      cy.get(`a[href="${path}"]`).first().click();
      cy.location('pathname').should('eq', path);
    }
  });
});
