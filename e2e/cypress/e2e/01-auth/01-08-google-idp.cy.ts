import { ADMIN } from '../../support/fixtures/accounts';

/**
 * Documented gap (SCOPE.md): the realm's `google` identity provider is
 * enabled but its `clientId`/`clientSecret` are deliberately left empty
 * (infra/keycloak/realm/feedbackhub-realm.json — no real credentials can be
 * committed). A real Google login cannot happen locally. This spec proves the
 * button exists and fails safely, rather than pretending to test a social
 * login that cannot run here.
 */
describe('Google sign-in (known gap — see SCOPE.md)', () => {
  it('the login page renders a Google button pointing at the broker endpoint', () => {
    cy.visit('/');
    cy.origin(Cypress.env('keycloakOrigin'), () => {
      cy.get('#social-google', { timeout: 20_000 })
        .should('exist')
        .should('have.attr', 'href')
        .and('include', '/broker/google/');
    });
  });

  it('clicking it fails safely on Keycloak\'s side — no app crash, no blank page', () => {
    cy.visit('/');
    cy.origin(Cypress.env('keycloakOrigin'), () => {
      cy.get('#social-google', { timeout: 20_000 }).click();
      // Empty client id -> Keycloak shows its own error page. It must still be
      // a real, rendered page (not blank), and the browser must remain on
      // Keycloak's origin rather than crashing the app.
      cy.get('body', { timeout: 20_000 }).should(($body) => {
        expect($body.text().trim().length).to.be.greaterThan(0);
      });
    });
    cy.location('origin').should('eq', Cypress.env('keycloakOrigin'));
  });

  it('password sign-in still works afterwards — the failed social attempt does not wedge the login page', () => {
    cy.signIn(ADMIN);
    cy.request('/v1/bootstrap').its('status').should('eq', 200);
  });
});
