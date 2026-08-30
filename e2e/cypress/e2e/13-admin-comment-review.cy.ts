import { ADMIN, SAM } from '../support/accounts';
import { IDS, readAppSettings, stamp, writeAppSettings } from '../support/helpers';

describe('Admin review workflows', () => {
  beforeEach(() => cy.signIn(ADMIN));

  it('filters the board to the default status for review', () => {
    cy.apiGet('/bootstrap').then((response) => {
      const first = (response.body.statuses as Array<{ id: string; isDefault: boolean }>).find(
        (status) => status.isDefault,
      );
      expect(first).to.exist;
      cy.visit(`/?filtered=1&sort=newest&statusIds=${first!.id}`);
      cy.get('select#board-sort').should('have.value', 'newest');
      cy.location('search').should('contain', `statusIds=${first!.id}`);
    });
  });

  it('lets an admin inspect a comment without an inline rewrite control', () => {
    cy.signIn(ADMIN);
    writeAppSettings({ featureCommentsEnabled: true, commentsRequireApproval: false });

    const body = `Moderation flow ${stamp()}`;
    cy.signIn(SAM);
    cy.visit(`/requests/${IDS.spreadsheet}`);
    cy.get('textarea#comment-body').type(body);
    cy.contains('button', /add comment/i).click();
    cy.contains('li', body).should('be.visible');

    cy.signIn(ADMIN);
    cy.visit(`/requests/${IDS.spreadsheet}`);
    cy.contains('li', body).should('be.visible');
    cy.contains('li', body).find('textarea').should('not.exist');
    cy.contains('li', body).find('button').contains(/delete/i).should('be.visible');
  });

  it('exposes waiting-comment navigation only when approval is enabled', () => {
    readAppSettings().then((before) => {
      writeAppSettings({ commentsRequireApproval: false });
      cy.visit('/admin');
      cy.contains('a', /waiting comments/i).should('not.exist');

      writeAppSettings({ commentsRequireApproval: true });
      cy.reload();
      cy.contains('a', /waiting comments/i).should('be.visible');

      writeAppSettings({ commentsRequireApproval: before.commentsRequireApproval });
    });
  });
});
