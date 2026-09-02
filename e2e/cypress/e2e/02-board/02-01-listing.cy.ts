import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { SEED } from '../../support/fixtures/seed-ids';
import { TID } from '../../support/utils/testids';

describe('board listing', () => {
  beforeEach(() => {
    cy.visitAs(ADMIN, '/');
  });

  it('lists the seeded requests with title, status, category, author, votes', () => {
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.darkMode }).within(() => {
      cy.byTestId(TID.card.title).should('contain.text', 'Dark mode');
      cy.byTestId(TID.card.status).should('exist');
      cy.byTestId(TID.card.category).should('exist');
      cy.byTestId(TID.card.voteCount).should('contain.text', '3');
    });
  });

  it('groups the pinned request above the rest', () => {
    cy.byTestId(TID.board.pinnedGroup)
      .find(`[data-testid="${TID.card.root}"]`)
      .should('have.length.at.least', 1)
      .and(($cards) => {
        const ids = $cards.toArray().map((el) => el.getAttribute('data-request-id'));
        expect(ids).to.include(SEED.requests.darkMode);
      });
  });

  it('still renders the chip for a request whose category was later retired', () => {
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.retiredCategoryRequest }).within(() => {
      cy.byTestId(TID.card.category).should('exist');
    });
  });

  it('shows the comment count when comments are enabled', () => {
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.darkMode }).within(() => {
      cy.byTestId(TID.card.comments).should('exist');
    });
  });

  it("reflects the viewer's own vote state: everyone but Rae voted on the export request's absence, per seed", () => {
    // Seed votes on the pinned "dark mode" request: admin, rae, sam. On the
    // "search bug" request: sam only.
    cy.visitAs(SAM, '/');
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.darkMode })
      .find(`[data-testid="${TID.card.vote}"]`)
      .should('have.attr', 'aria-pressed', 'true');

    cy.visitAs(RAE, '/');
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.darkMode })
      .find(`[data-testid="${TID.card.vote}"]`)
      .should('have.attr', 'aria-pressed', 'true');
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.searchBug })
      .find(`[data-testid="${TID.card.vote}"]`)
      .should('have.attr', 'aria-pressed', 'false');
  });
});
