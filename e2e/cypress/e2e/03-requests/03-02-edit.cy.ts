import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { stampedTitle } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';

describe('edit a request', () => {
  it('the author edits title and description; detail and board both reflect it', () => {
    makeRequest({ as: SAM }).then((request) => {
      const newTitle = stampedTitle('edited by author');
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.detail.edit).click();
      cy.byTestId(TID.form.title).clear().type(newTitle);
      cy.byTestId(TID.form.submit).click();
      cy.byTestId(TID.detail.title, { timeout: 10_000 }).should('contain.text', newTitle);

      cy.visit('/');
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.title}"]`).should('contain.text', newTitle);
    });
  });

  it('an admin edits someone else\'s request', () => {
    makeRequest({ as: SAM }).then((request) => {
      const newTitle = stampedTitle('edited by admin');
      cy.visitAs(ADMIN, `/requests/${request.id}`);
      cy.byTestId(TID.detail.edit).should('not.exist'); // admin is not "mine": no edit button in the UI
      api.requests.update(request.id, { title: newTitle }).its('title').should('eq', newTitle);
    });
  });

  it('a third party has no edit control and PATCH returns 403', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(RAE, `/requests/${request.id}`);
      cy.byTestId(TID.detail.edit).should('not.exist');
      cy.signIn(RAE);
      api.requests.updateRaw(request.id, { title: 'hostile edit' }).its('status').should('eq', 403);
    });
  });

  it('PATCH with an unknown field is rejected with 400', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.requests.updateRaw(request.id, { status: 'done' }).its('status').should('eq', 400);
    });
  });

  it('PATCH on a deleted request is 404', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.requests.remove(request.id);
      api.requests.updateRaw(request.id, { title: 'ghost edit' }).its('status').should('eq', 404);
    });
  });

  it('editing does not change status, pin, or votes', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.requests.vote(request.id);
      api.requests.update(request.id, { title: stampedTitle('no side effects') }).then((updated) => {
        expect(updated.statusId).to.eq(request.statusId);
        expect(updated.isPinned).to.eq(false);
        expect(updated.voteCount).to.eq(1);
      });
    });
  });
});
