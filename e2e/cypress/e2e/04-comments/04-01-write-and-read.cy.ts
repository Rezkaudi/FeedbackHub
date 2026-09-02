import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { makeRequest, makeComment } from '../../support/fixtures/entities.fixture';
import { SEED } from '../../support/fixtures/seed-ids';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

describe('write and read comments', () => {
  it('shows the seeded published comments and not the deleted one, for an uninvolved viewer', () => {
    // The comment repository's viewer filter is `{}` (no filter at all) for
    // an admin — an admin sees every state, including 'deleted'. The filter
    // for everyone else is `state = published OR authorId = viewer.id`, and
    // the seeded deleted comment's author is Sam — so Sam sees his own
    // deleted comment too. Rae is signed in as neither, so this check is only
    // meaningful from her viewpoint.
    cy.visitAs(RAE, `/requests/${SEED.requests.darkMode}`);
    cy.byTestId(TID.comment.item).should('have.length', 2);
  });

  it('the empty state shows on a request with no comments', () => {
    cy.visitAs(ADMIN, `/requests/${SEED.requests.searchBug}`);
    cy.byTestId(TID.comment.empty, { timeout: 10_000 }).should('be.visible');
  });

  it('writing a comment appends it immediately and increments the header count', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.comment.body).type('A freshly written comment for this scenario.');
      cy.byTestId(TID.comment.submit).click();
      cy.byTestId(TID.comment.item, { timeout: 10_000 }).should('have.length', 1);
      cy.byTestId(TID.comment.count).should('contain.text', '1');
    });
  });

  it('the comment count on the board card increments too', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: RAE });
      cy.visitAs(ADMIN, '/');
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.comments}"]`).should('contain.text', '1');
    });
  });

  it('submit is disabled for a blank or whitespace-only body', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.comment.submit).should('be.disabled');
      cy.byTestId(TID.comment.body).type('   ');
      cy.byTestId(TID.comment.submit).should('be.disabled');
    });
  });

  it('a 2000-character body is accepted; 2001 is rejected by the API', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.comments.writeRaw(request.id, { body: 'x'.repeat(2000) }).its('status').should('eq', 201);
      api.comments.writeRaw(request.id, { body: 'x'.repeat(2001) }).its('status').should('eq', 400);
    });
  });

  it('cursor paging over many comments has no duplicates and no gaps', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      for (let i = 0; i < 25; i += 1) {
        api.comments.write(request.id, `Comment number ${i}`);
      }
      api.comments.list(request.id, { limit: 20 }).then((firstPage) => {
        expect(firstPage.items).to.have.length(20);
        expect(firstPage.nextCursor).to.not.eq(null);
        return api.comments.list(request.id, { limit: 20, cursor: firstPage.nextCursor! }).then((secondPage) => {
          expect(secondPage.items).to.have.length(5);
          expect(secondPage.nextCursor).to.eq(null);
          const allIds = [...firstPage.items, ...secondPage.items].map((c) => c.id);
          expect(new Set(allIds).size).to.eq(25);
        });
      });
    });
  });

  it('limit bounds are enforced', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.comments.listRaw(request.id); // baseline call, no assertion needed beyond shape
      cy.request({ url: `/v1/requests/${request.id}/comments?limit=0`, failOnStatusCode: false }).its('status').should('eq', 400);
      cy.request({ url: `/v1/requests/${request.id}/comments?limit=101`, failOnStatusCode: false }).its('status').should('eq', 400);
    });
  });

  it('commenting on a deleted request is 404', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.requests.remove(request.id);
      api.comments.writeRaw(request.id, { body: 'too late' }).its('status').should('eq', 404);
    });
  });
});
