import { ADMIN } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { TID } from '../../support/utils/testids';

describe('board paging and URL round trip', () => {
  it('deep-linking a fully populated query URL restores every control', () => {
    cy.visitAs(ADMIN, '/?filtered=1&search=board&sort=oldest&mine=1');
    cy.byTestId(TID.board.search).should('have.value', 'board');
    cy.byTestId(TID.board.sort).should('have.value', 'oldest');
  });

  it('reload preserves the query', () => {
    cy.visitAs(ADMIN, '/?filtered=1&search=board&sort=most_votes');
    cy.reload();
    cy.byTestId(TID.board.search).should('have.value', 'board');
    cy.byTestId(TID.board.sort).should('have.value', 'most_votes');
  });

  it('back and forward walk the query history', () => {
    cy.visitAs(ADMIN, '/');
    cy.byTestId(TID.board.search).type('dark');
    cy.location('search', { timeout: 10_000 }).should('include', 'search=dark');
    cy.byTestId(TID.board.search).clear().type('spread');
    cy.location('search', { timeout: 10_000 }).should('include', 'search=spread');
    cy.go('back');
    cy.location('search', { timeout: 10_000 }).should('include', 'search=dark');
    cy.go('forward');
    cy.location('search', { timeout: 10_000 }).should('include', 'search=spread');
  });

  it('page=0 and page=999 do not crash the API', () => {
    cy.visitAs(ADMIN, '/');
    cy.request({ url: '/v1/requests?page=0', failOnStatusCode: false }).its('status').should('eq', 400);
    cy.request({ url: '/v1/requests?page=999', failOnStatusCode: false }).its('status').should('eq', 200);
  });

  it('changing a filter resets to page 1', () => {
    cy.visitAs(ADMIN, '/?filtered=1&page=1');
    cy.byTestId(TID.board.search).type('e');
    cy.location('search', { timeout: 10_000 }).should('not.include', 'page=');
  });

  it('an unknown query param is ignored, not fatal', () => {
    cy.visitAs(ADMIN, '/?bogusParam=whatever');
    cy.byTestId(TID.board.search).should('be.visible');
  });

  describe('with enough requests for a second page', () => {
    const created: string[] = [];

    before(() => {
      cy.signIn(ADMIN);
      for (let i = 0; i < 22; i += 1) {
        makeRequest({ title: `Paging fixture request ${i} ${Date.now()}` });
      }
    });

    it('shows pagination with a correct summary and page controls', () => {
      cy.visitAs(ADMIN, '/?sort=newest');
      cy.byTestId(TID.board.pageSummary).should('be.visible');
      cy.byTestId(TID.board.pagePrev).should('be.disabled');
      cy.byTestId(TID.board.pageNext).should('not.be.disabled');
      cy.byTestId(TID.board.pageNext).click();
      cy.location('search', { timeout: 10_000 }).should('include', 'page=2');
      cy.byTestId(TID.board.pagePrev).should('not.be.disabled');
    });
  });
});
