import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { makeRequest, makeComment } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

describe('delete a request', () => {
  it('the author deletes from the detail page via the confirm dialog', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.detail.delete).click();
      cy.byTestId(TID.state.confirmAccept).click();
      cy.location('pathname', { timeout: 15_000 }).should('eq', '/');
      api.requests.readRaw(request.id).its('status').should('eq', 404);
    });
  });

  it('the author deletes from the board card', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, '/');
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.delete}"]`).click();
      cy.byTestId(TID.state.confirmAccept).click();
      cy.byTestIdFor(TID.card.root, { request: request.id }, { timeout: 10_000 }).should('not.exist');
      api.requests.readRaw(request.id).its('status').should('eq', 404);
    });
  });

  it('an admin deletes someone else\'s request', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(ADMIN, `/requests/${request.id}`);
      cy.byTestId(TID.detail.delete).click();
      cy.byTestId(TID.state.confirmAccept).click();
      cy.location('pathname', { timeout: 15_000 }).should('eq', '/');
      api.requests.readRaw(request.id).its('status').should('eq', 404);
    });
  });

  it('a third party has no delete control and DELETE returns 403', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(RAE, `/requests/${request.id}`);
      cy.byTestId(TID.detail.delete).should('not.exist');
      cy.signIn(RAE);
      api.requests.remove(request.id).its('status').should('eq', 403);
      // Cleanup is handled by the global afterEach, which always signs in as
      // ADMIN before deleting anything this test created (see
      // `drainCreated` in `entities.fixture.ts`).
    });
  });

  it('deleting a request with comments and votes succeeds, and its comments are gone with it', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE });
      cy.signIn(SAM);
      api.requests.vote(request.id);
      api.requests.remove(request.id).its('status').should('eq', 204);
      // The comment-list read path does not check the parent request exists —
      // it just queries by requestId — so deleted-request comments come back
      // as an empty 200 page, not a 404.
      api.comments.list(request.id).its('items').should('have.length', 0);
    });
  });

  it('cancelling the confirm dialog deletes nothing', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.detail.delete).click();
      cy.byTestId(TID.state.confirmCancel).click();
      cy.byTestId(TID.detail.title).should('be.visible');
      api.requests.read(request.id).its('id').should('eq', request.id);
    });
  });

  it('deleting twice returns 404 the second time', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.requests.remove(request.id).its('status').should('eq', 204);
      api.requests.remove(request.id).its('status').should('eq', 404);
    });
  });
});
