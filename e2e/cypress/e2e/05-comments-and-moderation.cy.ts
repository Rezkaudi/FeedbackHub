import { ADMIN, SAM } from '../support/accounts';
import { IDS, readAppSettings, stamp, writeAppSettings } from '../support/helpers';

const COMMENT_BOX = 'textarea#comment-body';

describe('Comments, moderation and the feature switch', () => {
  it('adds a published comment when approval is off', () => {
    cy.signIn(ADMIN);
    writeAppSettings({ featureCommentsEnabled: true, commentsRequireApproval: false });

    cy.signIn(SAM);
    cy.visit(`/requests/${IDS.spreadsheet}`);
    const body = `Published comment ${stamp()}`;
    cy.get(COMMENT_BOX).type(body);
    cy.contains('button', /add comment/i).click();
    cy.contains('li', body).should('be.visible').and('not.contain', 'Waiting for approval');
  });

  it('lets the author change their own comment at the API boundary', () => {
    cy.signIn(SAM);
    cy.visit(`/requests/${IDS.spreadsheet}`);
    const body = `Editable comment ${stamp()}`;
    cy.get(COMMENT_BOX).type(body);
    cy.contains('button', /add comment/i).click();
    cy.contains('li', body).should('be.visible');

    cy.apiGet(`/requests/${IDS.spreadsheet}/comments`).then((response) => {
      const mine = (response.body.items as Array<{ id: string; body: string }>).find(
        (c) => c.body === body,
      );
      expect(mine, 'the comment just written').to.exist;
      cy.apiPatch(`/comments/${mine!.id}`, { body: `${body} edited` }).its('status').should('eq', 200);
    });

    cy.reload();
    cy.contains(`${body} edited`).should('be.visible');
  });

  it('does not allow a normal user to read the admin pending-comments queue', () => {
    cy.signIn(SAM);
    cy.apiGet('/admin/comments/pending', false).its('status').should('eq', 403);
  });

  it('admin can moderate somebody else’s published comment', () => {
    cy.signIn(ADMIN);
    writeAppSettings({ featureCommentsEnabled: true, commentsRequireApproval: false });

    const body = `Admin deletes this comment ${stamp()}`;
    cy.signIn(SAM);
    cy.visit(`/requests/${IDS.spreadsheet}`);
    cy.get(COMMENT_BOX).type(body);
    cy.contains('button', /add comment/i).click();
    cy.contains('li', body).should('be.visible');

    cy.signIn(ADMIN);
    cy.visit(`/requests/${IDS.spreadsheet}`);
    cy.contains('li', body).find('button').contains(/delete/i).click();
    cy.contains('li', body).should('not.exist');
    cy.contains('This comment was deleted.').should('be.visible');
    cy.reload();
    cy.contains('li', body).should('not.exist');
  });

  it('approves a waiting comment when moderation is enabled', () => {
    const body = `Approval comment ${stamp()}`;
    cy.signIn(ADMIN);
    readAppSettings().then((before) => {
      writeAppSettings({ featureCommentsEnabled: true, commentsRequireApproval: true });

      cy.signIn(SAM);
      cy.visit(`/requests/${IDS.spreadsheet}`);
      cy.get(COMMENT_BOX).type(body);
      cy.contains('button', /add comment/i).click();
      cy.contains('li', body).contains(/waiting for approval/i).should('be.visible');

      cy.signIn(ADMIN);
      cy.visit('/admin/comments');
      cy.contains('li', body).contains('button', /approve/i).click();
      cy.contains('li', body).should('not.exist');

      cy.signIn(SAM);
      cy.visit(`/requests/${IDS.spreadsheet}`);
      cy.contains('li', body).should('be.visible').and('not.contain', 'Waiting for approval');

      cy.signIn(ADMIN);
      writeAppSettings({
        commentsRequireApproval: before.commentsRequireApproval,
        featureCommentsEnabled: before.featureCommentsEnabled,
      });
    });
  });

  it('rejects a waiting comment and keeps the thread consistent', () => {
    const body = `Rejected comment ${stamp()}`;
    cy.signIn(ADMIN);
    readAppSettings().then((before) => {
      writeAppSettings({ featureCommentsEnabled: true, commentsRequireApproval: true });

      cy.signIn(SAM);
      cy.visit(`/requests/${IDS.spreadsheet}`);
      cy.get(COMMENT_BOX).type(body);
      cy.contains('button', /add comment/i).click();
      cy.contains('li', body).should('be.visible');

      cy.signIn(ADMIN);
      cy.visit('/admin/comments');
      cy.contains('li', body).contains('button', /reject/i).click();
      cy.contains('li', body).should('not.exist');

      cy.signIn(SAM);
      cy.visit(`/requests/${IDS.spreadsheet}`);
      cy.contains(body).should('not.exist');

      cy.signIn(ADMIN);
      writeAppSettings({
        commentsRequireApproval: before.commentsRequireApproval,
        featureCommentsEnabled: before.featureCommentsEnabled,
      });
    });
  });

  it('turns comments off in both UI and server behavior', () => {
    cy.signIn(ADMIN);
    readAppSettings().then((before) => {
      writeAppSettings({ featureCommentsEnabled: false });

      cy.signIn(SAM);
      cy.visit(`/requests/${IDS.spreadsheet}`);
      cy.contains('h1', /Export the board to a spreadsheet/i).should('be.visible');
      cy.get(COMMENT_BOX).should('not.exist');
      cy.contains('h2', /^Comments/).should('not.exist');
      cy.apiPost(`/requests/${IDS.spreadsheet}/comments`, { body: 'Should be rejected.' }, false).then(
        (response) => {
          expect(response.status).to.eq(403);
          expect(response.body.error.code).to.eq('FEATURE_DISABLED');
        },
      );

      cy.signIn(ADMIN);
      writeAppSettings({ featureCommentsEnabled: before.featureCommentsEnabled });
    });
  });
});
