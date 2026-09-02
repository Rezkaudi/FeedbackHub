import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

describe('pin a request', () => {
  it('an admin pins from the board card and it joins the pinned group', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(ADMIN, '/');
      cy.byTestIdFor(TID.card.root, { request: request.id }).find(`[data-testid="${TID.card.pin}"]`).click();
      cy.byTestId(TID.board.pinnedGroup, { timeout: 10_000 })
        .find(`[data-request-id="${request.id}"]`)
        .should('exist');
    });
  });

  it('an admin unpins from the detail page, and aria-pressed tracks state', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.setPinned(request.id, true);
      cy.visitAs(ADMIN, `/requests/${request.id}`);
      cy.byTestId(TID.detail.pin).should('have.attr', 'aria-pressed', 'true').click();
      cy.byTestId(TID.detail.pin, { timeout: 10_000 }).should('have.attr', 'aria-pressed', 'false');
    });
  });

  it('the author, not an admin, sees no pin control and PATCH …/pin is 403', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.detail.pin).should('not.exist');
      cy.signIn(SAM);
      api.requests.setPinned(request.id, true).its('status').should('eq', 403);
    });
  });

  it('pinning twice is idempotent', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.setPinned(request.id, true).its('status').should('eq', 200);
      api.requests.setPinned(request.id, true).its('status').should('eq', 200);
    });
  });

  it('pinning does not alter status or votes', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.requests.vote(request.id);
      cy.signIn(ADMIN);
      api.requests.setPinned(request.id, true).then((response) => {
        expect(response.body.statusId).to.eq(request.statusId);
        expect(response.body.voteCount).to.eq(1);
      });
    });
  });

  it('an unknown UUID is 404; a non-UUID is 400', () => {
    cy.signIn(ADMIN);
    api.requests.setPinned('00000000-0000-4000-8000-000000000000', true).its('status').should('eq', 404);
    api.requests.setPinned('not-a-uuid', true).its('status').should('eq', 400);
  });
});
