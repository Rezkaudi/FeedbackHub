import { ADMIN, SAM } from '../support/accounts';
import { IDS } from '../support/helpers';

describe('Board, search, filtering, sorting and pagination', () => {
  beforeEach(() => cy.signIn(SAM));

  it('searches title and updates the URL', () => {
    cy.visit('/');
    cy.get('input#board-search').clear().type('Dark mode for the whole board');
    cy.location('search').should('contain', `search=${encodeURIComponent('Dark mode for the whole board')}`);
    cy.contains('a', 'Dark mode for the whole board').should('be.visible');
  });

  it('searches description text', () => {
    cy.visit('/');
    cy.get('input#board-search').clear().type('dark room');
    cy.contains('a', 'Dark mode for the whole board').should('be.visible');
  });

  it('shows an honest empty-search state', () => {
    cy.visit('/?search=zzzznothingmatchesthis');
    cy.contains(/no requests|nothing matches/i).should('be.visible');
  });

  it('applies a category filter without losing the URL state', () => {
    cy.visit('/');
    cy.contains('fieldset', 'Category').find('input[type="checkbox"]').first().check({ force: true });
    cy.location('search').should('contain', 'categoryIds=');
    cy.reload();
    cy.location('search').should('contain', 'categoryIds=');
  });

  it('changes sort order and preserves it after reload', () => {
    cy.visit('/?sort=oldest');
    cy.get('select#board-sort').should('have.value', 'oldest');
    cy.reload();
    cy.get('select#board-sort').should('have.value', 'oldest');
  });

  it('uses pinned-first ordering independent of sort order', () => {
    cy.signIn(ADMIN);
    cy.apiPatch(`/requests/${IDS.spreadsheet}/pin`, { pinned: true }).its('status').should('eq', 200);
    cy.visit('/?filtered=1&sort=oldest');
    cy.get('article').should('exist');
    cy.get('article').first().should('contain.text', 'Export the board to a spreadsheet');
    cy.apiPatch(`/requests/${IDS.spreadsheet}/pin`, { pinned: false }).its('status').should('eq', 200);
  });

  it('moves back from an empty page to something readable', () => {
    cy.visit('/?page=999');
    cy.get('body').should('not.contain', 'undefined');
    cy.contains(/requests? found|nothing matches|no requests/i).should('be.visible');
  });
});
