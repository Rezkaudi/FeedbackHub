import { SAM } from '../support/accounts';
import { IDS } from '../support/helpers';

describe('Smoke, routing and core navigation', () => {
  beforeEach(() => cy.signIn(SAM));

  it('opens the board and renders seeded content', () => {
    cy.visit('/');
    cy.contains('h1', /Feedback/i).should('be.visible');
    cy.contains(/dark mode for the whole board/i).should('be.visible');
  });

  it('opens a request from the board', () => {
    cy.findAndOpenRequest('Dark mode for the whole board');
    cy.contains('h1', /Dark mode for the whole board/i).should('be.visible');
  });

  it('opens the new-request form', () => {
    cy.visit('/requests/new');
    cy.contains('h1', /new request/i).should('be.visible');
    cy.get('input#title').should('be.visible');
    cy.get('textarea#description').should('be.visible');
    cy.get('[role="radiogroup"]').should('be.visible');
  });

  it('opens personal settings and preserves the route', () => {
    cy.visit('/profile');
    cy.get('input#displayName').should('be.visible');
    cy.location('pathname').should('eq', '/profile');
  });

  it('handles not-found and not-allowed screens', () => {
    cy.visit('/some-route-that-cannot-exist');
    cy.contains(/this page does not exist/i).should('be.visible');

    cy.visit('/not-allowed');
    cy.contains(/cannot open this page|for admins/i).should('be.visible');
  });

  it('supports board query-string deep links', () => {
    cy.apiGet('/bootstrap').then((response) => {
      const defaultStatus = (response.body.statuses as Array<{ id: string; isDefault: boolean }>).find(
        (s) => s.isDefault,
      );
      expect(defaultStatus).to.exist;
      cy.visit(`/?filtered=1&sort=newest&statusIds=${defaultStatus!.id}`);
      cy.get('select#board-sort').should('have.value', 'newest');
      cy.location('search').should('contain', `statusIds=${defaultStatus!.id}`);
    });
  });

  it('keeps old requests readable when a retired taxonomy value is used', () => {
    cy.visit(`/requests/${IDS.retiredCategoryRequest}`);
    cy.contains('Legacy').should('be.visible');
    cy.contains('(retired)', { matchCase: false }).should('be.visible');
  });
});
