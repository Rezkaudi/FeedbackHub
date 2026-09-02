import { ADMIN } from '../../support/fixtures/accounts';
import { TID } from '../../support/utils/testids';

describe('board empty and error states', () => {
  it('filtering to an impossible combination shows the filtered-empty panel', () => {
    cy.visitAs(ADMIN, '/?filtered=1&search=zzzznothingmatchesthiszzz');
    cy.byTestId(TID.board.emptyFiltered, { timeout: 10_000 }).should('be.visible');
  });

  it('an intercepted 500 on the board shows the error panel with a requestId and a working retry', () => {
    cy.visitAs(ADMIN, '/');
    cy.byTestId(TID.card.root, { timeout: 10_000 }).should('exist');

    cy.intercept('GET', '/v1/requests*', {
      statusCode: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'boom', requestId: 'req_e2e_test' } },
    }).as('boardFail');
    // A real character, not whitespace: the board trims the search term
    // before comparing it to the current query, so a space alone never
    // triggers a reload.
    cy.byTestId(TID.board.search).type('e');
    cy.wait('@boardFail');
    cy.byTestId(TID.board.error, { timeout: 10_000 }).should('be.visible').and('contain.text', 'req_e2e_test');

    cy.intercept('GET', '/v1/requests*', (req) => req.continue()).as('boardOk');
    cy.byTestId(`${TID.board.error}-retry`).click();
    cy.wait('@boardOk');
    cy.byTestId(TID.card.root, { timeout: 10_000 }).should('exist');
  });

  it('a 401 mid-browse sends the person to sign-in rather than showing an error panel', () => {
    cy.visitAs(ADMIN, '/');
    cy.byTestId(TID.card.root, { timeout: 10_000 }).should('exist');
    cy.clearCookies();
    cy.reload();
    cy.origin(Cypress.env('keycloakOrigin'), () => {
      cy.get('#username', { timeout: 20_000 }).should('be.visible');
    });
  });
});
