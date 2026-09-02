import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { SEED } from '../../support/fixtures/seed-ids';
import { TID } from '../../support/utils/testids';
import { api } from '../../support/clients/api.client';

describe('board search, filter, sort', () => {
  beforeEach(() => {
    cy.visitAs(ADMIN, '/');
  });

  it('search narrows the list by title and updates the URL', () => {
    cy.byTestId(TID.board.search).type('Dark mode');
    cy.location('search', { timeout: 10_000 }).should('include', 'search=Dark');
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.darkMode }).should('exist');
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.spreadsheet }).should('not.exist');
  });

  it('search matches the description as well as the title', () => {
    cy.byTestId(TID.board.search).type('quarterly review');
    cy.location('search', { timeout: 10_000 }).should('include', 'search=');
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.spreadsheet }).should('exist');
  });

  it('a search with no matches shows the filtered-empty panel with a way to clear', () => {
    cy.byTestId(TID.board.search).type('no request will ever match this exact nonsense string');
    cy.byTestId(TID.board.emptyFiltered, { timeout: 10_000 }).should('be.visible');
    cy.byTestId(TID.board.emptyClearFilters).click();
    cy.location('search').should('not.include', 'search=');
  });

  it('status chips filter the board', () => {
    api.taxonomy.read().then((taxonomy) => {
      const done = taxonomy.statuses.find((s) => s.slug === 'done')!;
      cy.byTestId(TID.board.filtersOpen).click();
      cy.byTestId(TID.board.filtersDialog).within(() => {
        cy.get(`#status-${done.id}`).click({ force: true });
      });
      cy.location('search', { timeout: 10_000 }).should('include', `statusIds=${done.id}`);
      cy.byTestIdFor(TID.card.root, { request: SEED.requests.spreadsheet }).should('exist');
      cy.byTestIdFor(TID.card.root, { request: SEED.requests.searchBug }).should('not.exist');
    });
  });

  it('category chips filter the board', () => {
    api.taxonomy.read().then((taxonomy) => {
      const bug = taxonomy.categories.find((c) => c.slug === 'bug')!;
      cy.byTestId(TID.board.filtersOpen).click();
      cy.byTestId(TID.board.filtersDialog).within(() => {
        cy.get(`#category-${bug.id}`).click({ force: true });
      });
      cy.location('search', { timeout: 10_000 }).should('include', `categoryIds=${bug.id}`);
      cy.byTestIdFor(TID.card.root, { request: SEED.requests.searchBug }).should('exist');
      cy.byTestIdFor(TID.card.root, { request: SEED.requests.spreadsheet }).should('not.exist');
    });
  });

  it('"mine" shows only the signed-in person\'s own requests', () => {
    cy.visitAs(SAM, '/');
    cy.byTestId(TID.board.mine).click();
    cy.location('search', { timeout: 10_000 }).should('include', 'mine=1');
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.darkMode }).should('exist');
    cy.byTestIdFor(TID.card.root, { request: SEED.requests.searchBug }).should('not.exist');
  });

  it('all four sorts order the board the same way the API orders it', () => {
    for (const sort of ['newest', 'oldest', 'most_votes', 'most_comments'] as const) {
      cy.byTestId(TID.board.sort).select(sort);
      cy.location('search', { timeout: 10_000 }).should(sort === 'newest' ? 'not.include' : 'include', sort === 'newest' ? 'sort=' : `sort=${sort}`);
      api.requests.list({ sort }).then((page) => {
        cy.get(`[data-testid="${TID.card.root}"]`).then(($cards) => {
          const domOrder = $cards.toArray().map((el) => el.getAttribute('data-request-id'));
          const apiOrder = page.items.map((r) => r.id);
          expect(domOrder).to.deep.equal(apiOrder);
        });
      });
    }
  });

  it('active-filter chips appear per filter, and removing one removes only that filter', () => {
    cy.byTestId(TID.board.search).type('board');
    api.taxonomy.read().then((taxonomy) => {
      const bug = taxonomy.categories.find((c) => c.slug === 'bug')!;
      cy.byTestId(TID.board.filtersOpen).click();
      cy.byTestId(TID.board.filtersDialog).within(() => cy.get(`#category-${bug.id}`).click({ force: true }));
      // The filters dialog stays open until explicitly dismissed; close it so
      // the active-filter chips underneath are clickable.
      cy.byTestId(`${TID.board.filtersDialog}-close`).click();
      cy.byTestId(TID.board.activeFilter).should('have.length', 2);
      cy.byTestId(TID.board.activeFilter).first().click();
      cy.byTestId(TID.board.activeFilter).should('have.length', 1);
    });
  });

  it('clear-all resets every filter, keeping only the "explicit" sentinel', () => {
    // Every app-written URL carries `filtered=1` — it is what tells "no
    // filters in the address" apart from "no filters, and I mean it" (see
    // board-query.ts), so it is expected to survive a clear, not disappear.
    cy.byTestId(TID.board.search).type('anything');
    cy.byTestId(TID.board.clearAll, { timeout: 10_000 }).click();
    cy.location('search').should('eq', '?filtered=1');
    cy.byTestId(TID.board.search).should('have.value', '');
  });

  it('a retired category still appears as a filter option, so old requests stay findable', () => {
    cy.byTestId(TID.board.filtersOpen).click();
    cy.byTestId(TID.board.filtersDialog).within(() => {
      cy.contains('label', /Legacy/i).should('exist');
    });
  });
});
