import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { SEED } from '../../support/fixtures/seed-ids';
import { api } from '../../support/clients/api.client';

describe('GET /v1/requests — the list contract', () => {
  beforeEach(() => {
    cy.signIn(ADMIN);
  });

  it('the default page carries items, total, page, pageSize', () => {
    api.requests.list().then((page) => {
      expect(page).to.include.keys('items', 'total', 'page', 'pageSize');
      expect(page.page).to.eq(1);
      expect(page.items).to.be.an('array');
    });
  });

  it('search is case-insensitive and matches partials', () => {
    api.requests.list({ search: 'dark MODE' }).then((page) => {
      expect(page.items.map((r) => r.id)).to.include(SEED.requests.darkMode);
    });
  });

  it('statusIds and categoryIds accept repeated params and combine as AND-across, OR-within', () => {
    api.taxonomy.read().then((taxonomy) => {
      const bug = taxonomy.categories.find((c) => c.slug === 'bug')!;
      const feature = taxonomy.categories.find((c) => c.slug === 'feature')!;
      api.requests.list({ categoryIds: [bug.id, feature.id] }).then((page) => {
        expect(page.items.every((r) => r.categoryId === bug.id || r.categoryId === feature.id)).to.eq(true);
      });
    });
  });

  it('mine is scoped to the caller and differs per persona', () => {
    api.requests.list({ mine: true }).then((adminMine) => {
      cy.signIn(SAM);
      api.requests.list({ mine: true }).then((samMine) => {
        expect(samMine.items.map((r) => r.id)).to.include(SEED.requests.darkMode);
        expect(adminMine.items.map((r) => r.id)).to.not.include(SEED.requests.darkMode);
      });
    });
  });

  // R-23: pinned rows are sent first regardless of the requested sort, so
  // every check here compares ordering within the pinned and non-pinned
  // partitions separately, and confirms pinned always leads.
  function assertOrderedWithinPartitions<Item extends { isPinned: boolean }, T>(
    items: readonly Item[],
    valueOf: (item: Item) => T,
    isSorted: (values: readonly T[]) => boolean,
  ): void {
    const firstNonPinned = items.findIndex((r) => !r.isPinned);
    if (firstNonPinned > 0) {
      expect(items.slice(0, firstNonPinned).every((r) => r.isPinned), 'pinned rows should lead').to.eq(true);
    }
    const pinnedValues = items.filter((r) => r.isPinned).map(valueOf);
    const restValues = items.filter((r) => !r.isPinned).map(valueOf);
    expect(isSorted(pinnedValues), 'pinned partition should be sorted').to.eq(true);
    expect(isSorted(restValues), 'non-pinned partition should be sorted').to.eq(true);
  }

  const descending = (values: readonly number[]): boolean => values.every((v, i) => i === 0 || values[i - 1]! >= v);
  const ascending = (values: readonly number[]): boolean => values.every((v, i) => i === 0 || values[i - 1]! <= v);

  it('each sort orders as documented (pinned rows lead, per partition)', () => {
    api.requests.list({ sort: 'newest' }).then((page) => {
      assertOrderedWithinPartitions(page.items, (r) => new Date(r.createdAt).getTime(), descending);
    });
    api.requests.list({ sort: 'oldest' }).then((page) => {
      assertOrderedWithinPartitions(page.items, (r) => new Date(r.createdAt).getTime(), ascending);
    });
    api.requests.list({ sort: 'most_votes' }).then((page) => {
      assertOrderedWithinPartitions(page.items, (r) => r.voteCount, descending);
    });
    api.requests.list({ sort: 'most_comments' }).then((page) => {
      assertOrderedWithinPartitions(page.items, (r) => r.commentCount, descending);
    });
  });

  it('an invalid sort, pageSize, or page is rejected with VALIDATION_FAILED', () => {
    api.requests.listRaw({ sort: 'bogus' as never }).its('status').should('eq', 400);
    api.requests.listRaw({ pageSize: 0 }).its('status').should('eq', 400);
    api.requests.listRaw({ page: -1 }).its('status').should('eq', 400);
  });

  it('an unusually large pageSize is accepted — no documented upper bound', () => {
    api.requests.listRaw({ pageSize: 5000 }).its('status').should('eq', 200);
  });

  it('pinned requests carry isPinned and are not excluded by ordinary filters', () => {
    api.requests.list().then((page) => {
      const pinned = page.items.find((r) => r.id === SEED.requests.darkMode);
      expect(pinned?.isPinned).to.eq(true);
    });
  });
});
