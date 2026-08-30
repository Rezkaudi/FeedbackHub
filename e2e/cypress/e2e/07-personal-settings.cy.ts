import { SAM } from '../support/accounts';

describe('Personal settings and preferences', () => {
  beforeEach(() => cy.signIn(SAM));

  it('updates display name and persists after reload', () => {
    cy.visit('/settings');
    cy.get('input#displayName').clear().type('Sam Updated');
    cy.contains('button', /save profile/i).click();
    cy.contains(/^Saved\.?$/).should('be.visible');
    cy.reload();
    cy.get('input#displayName').should('have.value', 'Sam Updated');

    // Put the name back so the rest of the suite sees the seeded value.
    cy.get('input#displayName').clear().type('Sam Sample');
    cy.contains('button', /save profile/i).click();
    cy.contains(/^Saved\.?$/).should('be.visible');
  });

  it('switches theme and persists the explicit preference', () => {
    cy.visit('/settings');
    cy.get('select#theme').select('dark');
    cy.get('html').should('have.attr', 'data-theme', 'dark');
    cy.reload();
    cy.get('html').should('have.attr', 'data-theme', 'dark');
    cy.get('select#theme').select('system');
    cy.get('html').should('not.have.attr', 'data-theme');
  });

  it('changes notification preferences and confirms the save', () => {
    cy.visit('/settings');
    cy.contains('fieldset', /email me/i)
      .find('input[type="checkbox"]')
      .first()
      .click({ force: true });
    cy.contains('button', /save language and email/i).click();
    cy.contains(/^Saved\.?$/).should('be.visible');
  });
});
