import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BoardStore } from './board.store';
import type { BoardQuery } from './board-query';

/**
 * R-25: the board has four states, and the two empty ones are different.
 * "No requests yet. Be the first." is what a new company sees, and it must not
 * look broken. "Nothing matches these filters" needs a Clear button. Showing
 * the first when the person has a filter on is the bug this store exists to
 * prevent.
 */
describe('the board', () => {
  let store: BoardStore;
  let http: HttpTestingController;

  const query = (over: Partial<BoardQuery> = {}): BoardQuery => ({
    search: '',
    statusIds: [],
    categoryIds: [],
    sort: 'newest',
    page: 1,
    ...over,
  });

  const aRequest = (id: string) => ({
    id,
    title: `Request ${id}`,
    description: 'Something',
    categoryId: 'c1',
    statusId: 's1',
    authorName: 'Sam',
    authorAvatarUrl: null,
    isPinned: false,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    voteCount: 0,
    commentCount: 0,
    viewerHasVoted: false,
    isMine: false,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), BoardStore],
    });
    store = TestBed.inject(BoardStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Let the microtask queue drain, so a request issued after an await is
   * registered before the test looks for it. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  describe('what it asks the server for', () => {
    it('sends the search, both filters, the sort and the page', async () => {
      const done = store.load(
        query({
          search: 'dark',
          statusIds: ['s1', 's2'],
          categoryIds: ['c1'],
          sort: 'most_votes',
          page: 2,
        }),
      );

      const request = http.expectOne((candidate) => candidate.url === '/v1/requests');
      const params = request.request.params;

      expect(params.get('search')).toBe('dark');
      expect(params.getAll('statusIds')).toEqual(['s1', 's2']);
      expect(params.getAll('categoryIds')).toEqual(['c1']);
      expect(params.get('sort')).toBe('most_votes');
      expect(params.get('page')).toBe('2');

      // A non-empty page: an empty page 2 would legitimately mean "past the
      // end" and trigger the correction below, which is a different test.
      request.flush({ items: [aRequest('a')], total: 21, page: 2, pageSize: 20 });
      await done;
    });

    it('leaves out what is empty, rather than sending blanks', async () => {
      const done = store.load(query());

      const request = http.expectOne((candidate) => candidate.url === '/v1/requests');
      expect(request.request.params.has('search')).toBe(false);
      expect(request.request.params.has('statusIds')).toBe(false);

      request.flush({ items: [], total: 0, page: 1, pageSize: 20 });
      await done;
    });
  });

  describe('the four states', () => {
    it('is loading while the call is in flight', () => {
      void store.load(query());

      expect(store.state()).toBe('loading');

      http.expectOne((c) => c.url === '/v1/requests').flush({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
    });

    it('is ready with the rows when there are some', async () => {
      const done = store.load(query());
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [aRequest('a'), aRequest('b')], total: 2, page: 1, pageSize: 20 });
      await done;

      expect(store.state()).toBe('ready');
      expect(store.items()).toHaveLength(2);
      expect(store.total()).toBe(2);
    });

    /** "No requests yet. Be the first." — the first thing a new company sees. */
    it('is empty when the board itself is empty and nothing was filtered', async () => {
      const done = store.load(query());
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [], total: 0, page: 1, pageSize: 20 });
      await done;

      expect(store.state()).toBe('empty');
    });

    /** "Nothing matches these filters." — a different message, with a Clear. */
    it('is a different empty when a filter is what hid everything', async () => {
      const done = store.load(query({ statusIds: ['s1'] }));
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [], total: 0, page: 1, pageSize: 20 });
      await done;

      expect(store.state()).toBe('emptyForFilters');
    });

    it('counts a search as a filter, so searching for nothing says so', async () => {
      const done = store.load(query({ search: 'zzz' }));
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [], total: 0, page: 1, pageSize: 20 });
      await done;

      expect(store.state()).toBe('emptyForFilters');
    });

    it('is failed, with something the screen can explain and retry', async () => {
      const done = store.load(query());
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(store.state()).toBe('failed');
      expect(store.error()?.isRetryable).toBe(true);
    });

    /** R-25: "Error … Filters stay as they were." */
    it('keeps the rows it already had when a reload fails, rather than blanking', async () => {
      const first = store.load(query());
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [aRequest('a')], total: 1, page: 1, pageSize: 20 });
      await first;

      const second = store.load(query({ page: 2 }));
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({}, { status: 500, statusText: 'Server Error' });
      await second;

      expect(store.state()).toBe('failed');
      expect(store.items()).toHaveLength(1);
    });
  });

  /**
   * SRS 15.1: "Page 5 of a list that shrank to 2 pages -> go back to the last
   * real page, do not show an empty page."
   *
   * This happens for real: somebody bookmarks page 5, requests get deleted, and
   * the bookmark now points past the end. An empty page with working pagination
   * underneath looks like the board broke.
   */
  describe('a page that is past the end', () => {
    it('asks again for the last page that exists', async () => {
      const done = store.load(query({ page: 5 }));

      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [], total: 25, page: 5, pageSize: 20 });
      await settle();

      // 25 rows at 20 a page is two pages, so page 5 cannot be right.
      const retry = http.expectOne((c) => c.url === '/v1/requests');
      expect(retry.request.params.get('page')).toBe('2');
      retry.flush({ items: [aRequest('x')], total: 25, page: 2, pageSize: 20 });
      await done;

      expect(store.state()).toBe('ready');
      expect(store.page()).toBe(2);
    });

    it('does not do it twice, so a disagreeing server cannot loop it', async () => {
      const done = store.load(query({ page: 5 }));

      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [], total: 25, page: 5, pageSize: 20 });
      await settle();
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [], total: 25, page: 2, pageSize: 20 });
      await done;

      // Still nothing, but it stops asking rather than bouncing for ever.
      expect(store.state()).toBe('empty');
      http.verify();
    });

    it('leaves an empty first page alone, because that is a real empty board', async () => {
      const done = store.load(query());
      http
        .expectOne((c) => c.url === '/v1/requests')
        .flush({ items: [], total: 0, page: 1, pageSize: 20 });
      await done;

      expect(store.state()).toBe('empty');
      http.verify();
    });
  });

  /**
   * Typing in the search box fires a request per pause. If an earlier, slower
   * answer lands after a later one, the board would show results for words the
   * person has already replaced.
   */
  it('ignores an answer that arrives after a newer one', async () => {
    const first = store.load(query({ search: 'da' }));
    const firstRequest = http.expectOne((c) => c.url === '/v1/requests');

    const second = store.load(query({ search: 'dark' }));
    const secondRequest = http.expectOne((c) => c.url === '/v1/requests');

    // The newer one comes back first, then the stale one.
    secondRequest.flush({ items: [aRequest('new')], total: 1, page: 1, pageSize: 20 });
    firstRequest.flush({ items: [aRequest('stale')], total: 9, page: 1, pageSize: 20 });
    await Promise.all([first, second]);

    expect(store.items()).toHaveLength(1);
    expect(store.items()[0]?.id).toBe('new');
    expect(store.total()).toBe(1);
  });

  it('knows how many pages there are, for the page buttons', async () => {
    const done = store.load(query());
    http
      .expectOne((c) => c.url === '/v1/requests')
      .flush({ items: [aRequest('a')], total: 41, page: 1, pageSize: 20 });
    await done;

    expect(store.pageCount()).toBe(3);
  });

  it('drops a request that is already gone without reporting an error', async () => {
    const done = store.load(query());
    http
      .expectOne((c) => c.url === '/v1/requests')
      .flush({ items: [aRequest('a'), aRequest('b')], total: 2, page: 1, pageSize: 20 });
    await done;

    const deleting = store.deleteRequest('b');
    http.expectOne('/v1/requests/b').flush(
      { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r' } },
      { status: 404, statusText: 'Not Found' },
    );

    expect(await deleting).toBeNull();
    expect(store.items().map((row) => row.id)).toEqual(['a']);
    expect(store.total()).toBe(1);
  });
});
