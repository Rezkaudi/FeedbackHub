import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

describe('votes', () => {
  it('votes from a board card: count +1, aria-pressed becomes true', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(RAE, '/');
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.vote}"]`).as('vote');
      cy.get('@vote').should('have.attr', 'aria-pressed', 'false');
      cy.get('@vote').click();
      cy.get('@vote').should('have.attr', 'aria-pressed', 'true');
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.voteCount}"]`).should('contain.text', '1');
    });
  });

  it('withdraws from the card: count drops back', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(RAE);
      api.requests.vote(request.id);
      cy.visitAs(RAE, '/');
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.vote}"]`).click();
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.voteCount}"]`).should('contain.text', '0');
    });
  });

  it('votes and withdraws from the detail page', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(RAE, `/requests/${request.id}`);
      cy.byTestId(TID.detail.vote).click();
      cy.byTestId(TID.detail.voteCount, { timeout: 10_000 }).should('contain.text', '1');
      cy.byTestId(TID.detail.vote).click();
      cy.byTestId(TID.detail.voteCount, { timeout: 10_000 }).should('contain.text', '0');
    });
  });

  it('voting on your own request is allowed', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.requests.vote(request.id).its('status').should('eq', 201);
    });
  });

  it('a second POST is idempotent (count stays at +1)', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(RAE);
      api.requests.vote(request.id);
      api.requests.vote(request.id).then((response) => {
        expect(response.body.voteCount).to.eq(1);
      });
    });
  });

  it('a DELETE with no prior vote is idempotent (no negative counts)', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(RAE);
      api.requests.unvote(request.id).then((response) => {
        expect(response.body.voteCount).to.eq(0);
      });
    });
  });

  it('the count and viewer state agree between board and detail after a reload', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(RAE);
      api.requests.vote(request.id);
      cy.visitAs(RAE, `/requests/${request.id}`);
      cy.byTestId(TID.detail.voteCount).should('contain.text', '1');
      cy.visit('/');
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.voteCount}"]`).should('contain.text', '1');
    });
  });

  it('two personas voting produce +2', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(RAE);
      api.requests.vote(request.id);
      cy.signIn(ADMIN);
      api.requests.vote(request.id).then((response) => {
        expect(response.body.voteCount).to.eq(2);
      });
    });
  });

  it('a vote on a deleted request is 404', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.requests.remove(request.id);
      api.requests.vote(request.id).its('status').should('eq', 404);
    });
  });
});
