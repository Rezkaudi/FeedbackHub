import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { makeRequest, makeComment } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

/** There is no comment-edit UI in the app (documented gap, SCOPE.md) — every
 *  PATCH case here is API-only. Delete is exercised through the UI too. */
describe('edit and delete comments', () => {
  it('the author can PATCH their own comment', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE }).then((comment) => {
        cy.signIn(RAE);
        api.comments.edit(comment.id, 'An edited body, from the author.').then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.body).to.eq('An edited body, from the author.');
        });
      });
    });
  });

  it('an admin editing someone else\'s comment is 403 — this is author-only, with no admin bypass', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE }).then((comment) => {
        cy.signIn(ADMIN);
        api.comments.edit(comment.id, 'admin trying to edit').its('status').should('eq', 403);
      });
    });
  });

  it('a stranger editing is 403', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE }).then((comment) => {
        cy.signIn(SAM);
        api.comments.edit(comment.id, 'stranger trying to edit').its('status').should('eq', 403);
      });
    });
  });

  it('the author deletes their own comment from the UI — hard delete, gone for good', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.comment.body).type('to be deleted by its author');
      cy.byTestId(TID.comment.submit).click();
      cy.byTestId(TID.comment.item, { timeout: 10_000 }).find(`[data-testid="${TID.comment.delete}"]`).click();
      cy.byTestId(TID.state.confirmAccept).click();
      cy.byTestId(TID.comment.item, { timeout: 10_000 }).should('not.exist');
    });
  });

  it('an admin deletes someone else\'s comment from the UI', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE }).then((comment) => {
        cy.visitAs(ADMIN, `/requests/${request.id}`);
        cy.get(`[data-testid="${TID.comment.item}"][data-comment-id="${comment.id}"]`)
          .find(`[data-testid="${TID.comment.delete}"]`)
          .click();
        cy.byTestId(TID.state.confirmAccept).click();
        cy.get(`[data-comment-id="${comment.id}"]`, { timeout: 10_000 }).should('not.exist');
      });
    });
  });

  it('a stranger has no delete control and DELETE is 403', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE }).then((comment) => {
        cy.visitAs(SAM, `/requests/${request.id}`);
        cy.get(`[data-comment-id="${comment.id}"]`).find(`[data-testid="${TID.comment.delete}"]`).should('not.exist');
        cy.signIn(SAM);
        api.comments.remove(comment.id).its('status').should('eq', 403);
      });
    });
  });

  it('deleting decrements the comment count on the board card', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE }).then((comment) => {
        cy.signIn(ADMIN);
        api.comments.remove(comment.id);
        cy.visitAs(ADMIN, '/');
        // The comment-count element is shown whenever comments are enabled,
        // regardless of the count — it never disappears at zero, it shows "0".
        cy.byTestIdFor(TID.card.root, { request: request.id })
          .find(`[data-testid="${TID.card.comments}"]`)
          .should('contain.text', '0');
      });
    });
  });

  it('deleting twice is 404; a non-UUID id is 400', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE }).then((comment) => {
        cy.signIn(ADMIN);
        api.comments.remove(comment.id).its('status').should('eq', 204);
        api.comments.remove(comment.id).its('status').should('eq', 404);
        api.comments.remove('not-a-uuid').its('status').should('eq', 400);
      });
    });
  });

  it('editing with an unknown body field is 400', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE }).then((comment) => {
        cy.signIn(RAE);
        cy.request({
          method: 'PATCH',
          url: `/v1/comments/${comment.id}`,
          headers: { origin: Cypress.config('baseUrl') as string },
          body: { body: 'ok', state: 'pending' },
          failOnStatusCode: false,
        })
          .its('status')
          .should('eq', 400);
      });
    });
  });
});
