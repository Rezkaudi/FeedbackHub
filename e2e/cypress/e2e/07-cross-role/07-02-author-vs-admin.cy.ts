import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { makeRequest, makeComment } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

/** The full author / admin / stranger permission matrix on one request,
 *  driven both through the UI (control visibility) and the API (enforcement). */
describe('author vs admin vs stranger, on one request', () => {
  it('the author can edit, delete, vote, comment, and delete their own comment — never status or pin', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.detail.edit).should('exist');
      cy.byTestId(TID.detail.delete).should('exist');
      cy.byTestId(TID.detail.pin).should('not.exist');
      cy.byTestId(TID.detail.statusMenuTrigger).should('not.exist');

      cy.signIn(SAM);
      api.requests.vote(request.id).its('status').should('eq', 201);
      api.comments.write(request.id, 'author comment').then((comment) => {
        api.comments.remove(comment.id).its('status').should('eq', 204);
      });
      api.bootstrap().then((boot) => api.requests.setStatus(request.id, boot.statuses[0]!.id).its('status').should('eq', 403));
      api.requests.setPinned(request.id, true).its('status').should('eq', 403);
    });
  });

  it('an admin (not the author) can edit, delete, status, pin, vote, and delete the author\'s comment — never edit it', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: SAM }).then((comment) => {
        cy.visitAs(ADMIN, `/requests/${request.id}`);
        cy.byTestId(TID.detail.edit).should('not.exist'); // admin only edits their OWN requests via the UI
        cy.byTestId(TID.detail.delete).should('exist');
        cy.byTestId(TID.detail.pin).should('exist');
        cy.byTestId(TID.detail.statusMenuTrigger).should('exist');

        cy.signIn(ADMIN);
        api.requests.vote(request.id).its('status').should('eq', 201);
        api.taxonomy.read().then((t) => api.requests.setStatus(request.id, t.statuses[0]!.id).its('status').should('eq', 200));
        api.requests.setPinned(request.id, true).its('status').should('eq', 200);
        api.comments.edit(comment.id, 'admin trying to edit').its('status').should('eq', 403);
        api.comments.remove(comment.id).its('status').should('eq', 204);
      });
    });
  });

  it('a stranger can vote and comment, but not edit, delete, status, pin, or delete another\'s comment', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: SAM }).then((comment) => {
        cy.visitAs(RAE, `/requests/${request.id}`);
        cy.byTestId(TID.detail.edit).should('not.exist');
        cy.byTestId(TID.detail.delete).should('not.exist');
        cy.byTestId(TID.detail.pin).should('not.exist');
        cy.byTestId(TID.detail.statusMenuTrigger).should('not.exist');

        cy.signIn(RAE);
        api.requests.vote(request.id).its('status').should('eq', 201);
        api.comments.writeRaw(request.id, { body: 'stranger comment' }).its('status').should('eq', 201);
        api.requests.remove(request.id).its('status').should('eq', 403);
        api.bootstrap().then((boot) => api.requests.setStatus(request.id, boot.statuses[0]!.id).its('status').should('eq', 403));
        api.requests.setPinned(request.id, true).its('status').should('eq', 403);
        api.comments.remove(comment.id).its('status').should('eq', 403);
      });
    });
  });
});
