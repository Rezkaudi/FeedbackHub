import { ADMIN, SAM } from '../support/accounts';
import { IDS, readAppSettings, stamp, writeAppSettings } from '../support/helpers';

const voteButton = () => cy.get('article button[aria-pressed]').first();

describe('Votes and interaction rules', () => {
  beforeEach(() => {
    cy.signIn(SAM);
    // Start every test from a known "not voted" state on the request under test.
    cy.apiDelete(`/requests/${IDS.spreadsheet}/vote`, false);
  });

  it('casts a vote and updates the UI', () => {
    cy.visitRequest(IDS.spreadsheet);
    voteButton().should('have.attr', 'aria-pressed', 'false').click();
    voteButton()
      .should('have.attr', 'aria-pressed', 'true')
      .and('have.attr', 'aria-label')
      .and('match', /you voted/i);
  });

  it('withdraws a vote and returns to the unvoted state', () => {
    cy.visitRequest(IDS.spreadsheet);
    voteButton().should('have.attr', 'aria-pressed', 'false').click();
    voteButton().should('have.attr', 'aria-pressed', 'true').click();
    voteButton().should('have.attr', 'aria-pressed', 'false');
  });

  it('is idempotent at the server boundary for duplicate vote creation', () => {
    cy.apiPost(`/requests/${IDS.spreadsheet}/vote`, {}, false).then((first) => {
      expect([200, 201]).to.include(first.status);
      expect(first.body).to.have.property('viewerHasVoted', true);
      cy.apiPost(`/requests/${IDS.spreadsheet}/vote`, {}, false).then((second) => {
        expect([200, 201]).to.include(second.status);
        expect(second.body).to.have.property('viewerHasVoted', true);
      });
    });
    cy.apiDelete(`/requests/${IDS.spreadsheet}/vote`, false).then((response) => {
      expect([200, 204]).to.include(response.status);
    });
  });

  it('enforces the vote rate limit for an authenticated user', () => {
    cy.signIn(ADMIN);
    readAppSettings().then((before) => {
      writeAppSettings({ voteLimitCount: 1, voteLimitMinutes: 1 });

      cy.signIn(SAM);
      cy.apiDelete(`/requests/${IDS.spreadsheet}/vote`, false);
      cy.apiDelete(`/requests/${IDS.darkMode}/vote`, false);

      cy.apiPost(`/requests/${IDS.spreadsheet}/vote`, {}, false).then((first) => {
        expect([200, 201]).to.include(first.status);
        cy.apiPost(`/requests/${IDS.darkMode}/vote`, {}, false).then((second) => {
          expect(second.status).to.eq(429);
          expect(second.body.error.code).to.eq('VOTE_RATE_LIMITED');
          expect(second.body.error.retryAt).to.exist;
        });
      });

      cy.signIn(ADMIN);
      writeAppSettings({
        voteLimitCount: before.voteLimitCount,
        voteLimitMinutes: before.voteLimitMinutes,
      });
      cy.signIn(SAM);
      cy.apiDelete(`/requests/${IDS.spreadsheet}/vote`, false);
    });
  });

  it('keeps unrelated browser state from affecting voting', () => {
    cy.visitRequest(IDS.raeRequest);
    voteButton().should('have.attr', 'aria-pressed');
    cy.setCookie(`noise-${stamp()}`, '1');
    cy.reload();
    voteButton().should('have.attr', 'aria-pressed');
  });
});
