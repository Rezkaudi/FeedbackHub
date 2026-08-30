import { ADMIN } from '../support/accounts';
import { IDS, stamp } from '../support/helpers';

describe('Administration: taxonomy and workflow', () => {
  beforeEach(() => cy.signIn(ADMIN));

  it('shows categories, usage counts and statuses', () => {
    cy.visit('/admin/taxonomy');
    cy.contains('h2', 'Categories').should('be.visible');
    cy.contains('h2', 'Statuses').should('be.visible');
    cy.contains('Feature').should('be.visible');
    cy.contains(/\d+ requests/).should('be.visible');
  });

  it('adds, retires, restores and deletes an unused category', () => {
    const name = `E2E category ${stamp()}`;
    cy.visit('/admin/taxonomy');
    cy.get('input#new-category').type(name);
    cy.contains('button', 'Add category').click();
    cy.contains('tr', name).should('be.visible');

    cy.visit('/requests/new');
    cy.get('select#categoryId option').contains(name).should('exist');

    cy.visit('/admin/taxonomy');
    cy.get(`button[aria-label="Retire ${name}"]`).click();
    cy.get(`button[aria-label="Bring back ${name}"]`).should('be.visible');

    cy.visit('/requests/new');
    cy.get('select#categoryId option').contains(name).should('not.exist');

    cy.visit('/admin/taxonomy');
    cy.get(`button[aria-label="Delete ${name}"]`).click();
    cy.contains('tr', name).should('not.exist');
  });

  it('does not offer Delete for an in-use category', () => {
    cy.visit('/admin/taxonomy');
    cy.contains('tr', 'Feature').within(() => {
      cy.get('button[aria-label^="Delete "]').should('not.exist');
      cy.get('button[aria-label^="Retire "]').should('be.visible');
    });
  });

  it('protects the first/default status from retirement', () => {
    cy.visit('/admin/taxonomy');
    cy.contains('tr', 'New').within(() => {
      cy.get('button[aria-label^="Retire "]').should('not.exist');
    });
  });

  it('changes a request status and persists it', () => {
    cy.visit(`/requests/${IDS.spreadsheet}`);
    cy.get('select#admin-status')
      .find('option')
      .contains('In Progress')
      .then(($option) => {
        const value = String($option.attr('value'));
        cy.get('select#admin-status').select(value);
        cy.reload();
        cy.get('select#admin-status').should('have.value', value);
      });

    // Restore the seeded status so later specs see the request as "Done".
    cy.apiGet('/bootstrap').then((response) => {
      const done = (response.body.statuses as Array<{ id: string; name: string }>).find(
        (s) => s.name === 'Done',
      );
      cy.apiPatch(`/requests/${IDS.spreadsheet}/status`, { statusId: done!.id })
        .its('status')
        .should('eq', 200);
    });
  });

  it('pins and unpins a request', () => {
    cy.visit(`/requests/${IDS.raeRequest}`);
    cy.contains('button', /pin to the top/i).click();
    cy.contains('button', /unpin from the top/i).should('be.visible').click();
    cy.contains('button', /pin to the top/i).should('be.visible');
  });
});
