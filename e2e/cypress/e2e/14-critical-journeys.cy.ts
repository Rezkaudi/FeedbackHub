import { ADMIN, SAM } from '../support/accounts';
import { IDS, stamp, writeAppSettings } from '../support/helpers';

const KEYCLOAK_AUTH = /realms\/feedbackhub\/protocol\/openid-connect\/auth/;

describe('Complete business-critical journeys', () => {
  it('user: sign in → create request → vote → comment → edit → sign out', () => {
    cy.signIn(ADMIN);
    writeAppSettings({ featureCommentsEnabled: true, commentsRequireApproval: false });

    cy.signIn(SAM);
    const title = `Critical journey ${stamp()}`;

    cy.visit('/requests/new');
    cy.apiGet('/bootstrap').then((response) => {
      const category = (response.body.categories as Array<{ id: string; isActive: boolean }>).find(
        (item) => item.isActive,
      )!;
      cy.get('input#title').type(title);
      cy.get('textarea#description').type('Critical journey description long enough for validation.');
      cy.get('input[name="categoryId"]').check(category.id, { force: true });
      cy.get('form button[type="submit"]').click();
    });

    cy.contains('h1', title, { timeout: 15_000 }).should('be.visible');

    cy.get('article button[aria-pressed]').first().should('have.attr', 'aria-pressed', 'false').click();
    cy.get('article button[aria-pressed]').first().should('have.attr', 'aria-pressed', 'true');

    cy.get('textarea#comment-body').type('Critical journey comment.');
    cy.contains('button', /add comment/i).click();
    cy.contains('Critical journey comment.').should('be.visible');

    cy.get('button[aria-label="Edit"]').should('be.visible');

    cy.contains('button', /sign out/i).click();
    cy.url({ timeout: 20_000 }).should('match', KEYCLOAK_AUTH);
  });

  it('admin: sign in → review board → change status → pin → settings → taxonomy', () => {
    cy.signIn(ADMIN);
    cy.visit('/?filtered=1&sort=newest');
    cy.contains('h1', /Feedback/i).should('be.visible');

    cy.visit(`/requests/${IDS.spreadsheet}`);
    cy.get('button[aria-label^="Change status"]').should('be.visible');
    cy.get('button[aria-label="Pin to the top"], button[aria-label="Unpin from the top"]').should('be.visible');

    cy.visit('/admin/settings');
    cy.get('select#policy').should('be.visible');

    cy.visit('/admin/taxonomy');
    cy.contains('h2', 'Categories').should('be.visible');
    cy.contains('h2', 'Statuses').should('be.visible');
  });
});
