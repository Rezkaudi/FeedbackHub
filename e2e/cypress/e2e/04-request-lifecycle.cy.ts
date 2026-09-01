import { SAM } from '../support/accounts';
import { activeTaxonomy, IDS, stamp } from '../support/helpers';

describe('Request creation, editing, ownership and deletion', () => {
  beforeEach(() => cy.signIn(SAM));

  function fillRequest(title: string, description: string) {
    activeTaxonomy().then((taxonomy) => {
      const category = taxonomy.categories.find((item) => item.isActive);
      expect(category, 'an active category').to.exist;
      cy.get('input#title').clear().type(title);
      cy.get('textarea#description').clear().type(description);
      cy.get('input[name="categoryId"]').check(category!.id, { force: true });
      cy.get('form button[type="submit"]').click();
    });
  }

  it('validates required fields and length boundaries', () => {
    cy.visit('/requests/new');
    cy.get('form button[type="submit"]').click();
    cy.contains(/give the request a title|describe what you are asking|pick a category/i).should(
      'be.visible',
    );
    cy.location('pathname').should('eq', '/requests/new');
  });

  it('creates a request with an active category and status', () => {
    const title = `E2E request ${stamp()}`;
    const description = `A complete end-to-end request ${stamp()} with a valid description.`;

    cy.visit('/requests/new');
    fillRequest(title, description);

    cy.contains('h1', title, { timeout: 15_000 }).should('be.visible');
    cy.reload();
    cy.contains(title).should('be.visible');
  });

  it('allows the owner to edit their request', () => {
    const title = `Editable E2E request ${stamp()}`;
    cy.visit('/requests/new');
    fillRequest(title, 'Original description that is long enough.');
    cy.contains('h1', title, { timeout: 15_000 }).should('be.visible');

    cy.get('button[aria-label="Edit"]').click();
    cy.get('textarea#description').clear().type('Updated description for the owner edit flow.');
    cy.get('form button[type="submit"]').click();
    cy.contains('Updated description for the owner edit flow.').should('be.visible');
  });

  it('does not offer owner controls on another person’s request', () => {
    cy.visit(`/requests/${IDS.raeRequest}`);
    cy.contains('h1', /search does not find/i).should('be.visible');
    cy.get('button[aria-label="Edit"]').should('not.exist');
    cy.contains('button', /delete request/i).should('not.exist');
  });

  it('rejects another user editing a request at the API boundary', () => {
    cy.apiPatch(`/requests/${IDS.raeRequest}`, { description: 'Unauthorized edit attempt here.' }, false)
      .its('status')
      .should('eq', 403);
  });

  it('rejects another user deleting a request at the API boundary', () => {
    cy.apiDelete(`/requests/${IDS.raeRequest}`, false).its('status').should('eq', 403);
  });

  it('supports request deep links and browser back/forward navigation', () => {
    cy.visit(`/requests/${IDS.spreadsheet}`);
    cy.contains('h1', /Export the board to a spreadsheet/i).should('be.visible');
    cy.visit('/');
    cy.go('back');
    cy.contains('h1', /Export the board to a spreadsheet/i).should('be.visible');
    cy.go('forward');
    cy.contains('h1', /Feedback/i).should('be.visible');
  });
});
