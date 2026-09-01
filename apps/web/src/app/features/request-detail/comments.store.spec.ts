import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CommentsStore } from './comments.store';

/**
 * R-33: a flat list, newest first. R-33b explains why it is read with a cursor
 * and not with page numbers, and it is the whole reason this store exists:
 * newest-first with page numbers shows the same comment twice whenever a new
 * one arrives while somebody is reading.
 *
 * R-33d: a comment a person writes goes to the top of the list at once, with no
 * reload and no second call.
 */
describe('the comment thread', () => {
  const REQUEST = 'r1';

  let store: CommentsStore;
  let http: HttpTestingController;

  const aComment = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    body: `Comment ${id}`,
    state: 'published',
    authorName: 'Sam',
    authorAvatarUrl: null,
    isMine: false,
    createdAt: '2026-08-01T10:00:00.000Z',
    ...over,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CommentsStore],
    });
    store = TestBed.inject(CommentsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** What the component does: the box writes the draft, the button sends it. */
  function addDraft(body: string): Promise<void> {
    store.setDraft(body);
    return store.add();
  }

  function expectList() {
    return http.expectOne((c) => c.url === `/v1/requests/${REQUEST}/comments`);
  }

  describe('reading', () => {
    it('asks for the newest first, with a limit and no cursor', async () => {
      const done = store.load(REQUEST);

      const request = expectList();
      expect(request.request.params.get('limit')).toBe('20');
      expect(request.request.params.has('cursor')).toBe(false);

      request.flush({ items: [aComment('a')], nextCursor: null, total: 1 });
      await done;

      expect(store.state()).toBe('ready');
      expect(store.items()).toHaveLength(1);
      expect(store.total()).toBe(1);
    });

    it('says when there are none yet, which is not an error', async () => {
      const done = store.load(REQUEST);
      expectList().flush({ items: [], nextCursor: null, total: 0 });
      await done;

      expect(store.state()).toBe('empty');
    });

    /**
     * SRS 15.2: "Comments failed but the request loaded -> error only in the
     * comments part; the rest of the page still works." So this failing must
     * never be the whole page's failure.
     */
    it('fails on its own, without taking the request down with it', async () => {
      const done = store.load(REQUEST);
      expectList().flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(store.state()).toBe('failed');
      expect(store.error()?.isRetryable).toBe(true);
    });

    it('offers more only while the server says there are more', async () => {
      const done = store.load(REQUEST);
      expectList().flush({ items: [aComment('a')], nextCursor: 'cursor-1', total: 40 });
      await done;

      expect(store.hasMore()).toBe(true);
    });

    it('offers no more once the cursor comes back empty', async () => {
      const done = store.load(REQUEST);
      expectList().flush({ items: [aComment('a')], nextCursor: null, total: 1 });
      await done;

      expect(store.hasMore()).toBe(false);
    });
  });

  describe('showing more', () => {
    async function loadFirstPage() {
      const done = store.load(REQUEST);
      expectList().flush({
        items: [aComment('a'), aComment('b')],
        nextCursor: 'cursor-1',
        total: 4,
      });
      await done;
    }

    it('sends back the cursor it was given, untouched', async () => {
      await loadFirstPage();

      const done = store.loadMore();
      const request = expectList();

      expect(request.request.params.get('cursor')).toBe('cursor-1');

      request.flush({ items: [aComment('c')], nextCursor: null, total: 4 });
      await done;
    });

    it('adds the older ones underneath, keeping the order', async () => {
      await loadFirstPage();

      const done = store.loadMore();
      expectList().flush({ items: [aComment('c'), aComment('d')], nextCursor: null, total: 4 });
      await done;

      expect(store.items().map((comment) => comment.id)).toEqual(['a', 'b', 'c', 'd']);
    });

    /**
     * R-33b, said plainly: "a comment arrives while I am reading -> it does not
     * push a comment I have already seen into the next block". The cursor
     * prevents it on the server, but a comment the person wrote themselves is
     * already at the top of our list, so an overlap can still arrive here.
     */
    it('never shows the same comment twice', async () => {
      await loadFirstPage();

      const done = store.loadMore();
      // The server repeats 'b' — for instance because a comment was deleted in
      // between and the window shifted.
      expectList().flush({ items: [aComment('b'), aComment('c')], nextCursor: null, total: 4 });
      await done;

      expect(store.items().map((comment) => comment.id)).toEqual(['a', 'b', 'c']);
    });

    it('keeps what it had when loading more fails', async () => {
      await loadFirstPage();

      const done = store.loadMore();
      expectList().flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(store.items()).toHaveLength(2);
      expect(store.moreError()).not.toBeNull();
      // The thread is still readable, so the whole part is not in a failed state.
      expect(store.state()).toBe('ready');
    });

    it('does nothing when there is no more to ask for', async () => {
      const done = store.load(REQUEST);
      expectList().flush({ items: [aComment('a')], nextCursor: null, total: 1 });
      await done;

      await store.loadMore();

      http.verify();
    });
  });

  describe('writing one', () => {
    async function ready() {
      const done = store.load(REQUEST);
      expectList().flush({ items: [aComment('a')], nextCursor: null, total: 1 });
      await done;
    }

    /** R-33d: at the top, at once, with no reload and no second call. */
    it('puts it at the top without asking the server for the list again', async () => {
      await ready();

      const done = addDraft('Something new');
      const request = http.expectOne(`/v1/requests/${REQUEST}/comments`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ body: 'Something new' });

      request.flush(aComment('new', { body: 'Something new', isMine: true }));
      await done;

      expect(store.items().map((comment) => comment.id)).toEqual(['new', 'a']);
      // No second GET. Asking again would be the reload R-33d forbids.
      http.verify();
    });

    it('counts it, so the number beside the thread moves too', async () => {
      await ready();

      const done = addDraft('Something new');
      http
        .expectOne(`/v1/requests/${REQUEST}/comments`)
        .flush(aComment('new', { isMine: true }));
      await done;

      expect(store.total()).toBe(2);
    });

    /**
     * R-40: with approval on, a waiting comment is visible only to its writer,
     * marked, and is not counted until an admin approves it.
     */
    it('shows a waiting comment to its writer but does not count it', async () => {
      await ready();

      const done = addDraft('Needs approval');
      http
        .expectOne(`/v1/requests/${REQUEST}/comments`)
        .flush(aComment('new', { state: 'pending', isMine: true }));
      await done;

      expect(store.items()[0]?.state).toBe('pending');
      expect(store.total()).toBe(1);
    });

    /** SRS 15.5: "The text I typed is kept in the box, with a message." */
    it('keeps the text and says why when saving fails', async () => {
      await ready();

      const done = addDraft('Something new');
      http
        .expectOne(`/v1/requests/${REQUEST}/comments`)
        .flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(store.items()).toHaveLength(1);
      expect(store.addError()).not.toBeNull();
      expect(store.draft()).toBe('Something new');
    });

    /** R-42: the switch was turned off while they were typing. */
    it('says comments are switched off rather than failing silently', async () => {
      await ready();

      const done = addDraft('Too late');
      http.expectOne(`/v1/requests/${REQUEST}/comments`).flush(
        { error: { code: 'FEATURE_DISABLED', message: 'Comments are switched off.', requestId: 'r' } },
        { status: 403, statusText: 'Forbidden' },
      );
      await done;

      expect(store.addError()?.code).toBe('FEATURE_DISABLED');
    });

    it('clears the box once it has been saved', async () => {
      await ready();

      const done = addDraft('Something new');
      http.expectOne(`/v1/requests/${REQUEST}/comments`).flush(aComment('new'));
      await done;

      expect(store.draft()).toBe('');
    });

    it('refuses to send an empty comment at all', async () => {
      await ready();

      await addDraft('   ');

      http.verify();
      expect(store.items()).toHaveLength(1);
    });
  });

  describe('removing one', () => {
    /**
     * Deleting a comment removes it everywhere — the row leaves the thread and
     * the count drops (this reverses the original R-38 grey line).
     */
    it('drops the row from the thread and stops counting it', async () => {
      const done = store.load(REQUEST);
      expectList().flush({
        items: [aComment('a'), aComment('b', { isMine: true }), aComment('c')],
        nextCursor: null,
        total: 3,
      });
      await done;

      const removing = store.remove('b');
      http.expectOne('/v1/comments/b').flush(null, { status: 204, statusText: 'No Content' });
      await removing;

      expect(store.items().map((comment) => comment.id)).toEqual(['a', 'c']);
      expect(store.total()).toBe(2);
    });

    it('treats an already-gone comment as removed, with no error', async () => {
      const done = store.load(REQUEST);
      expectList().flush({
        items: [aComment('a'), aComment('b', { isMine: true })],
        nextCursor: null,
        total: 2,
      });
      await done;

      const removing = store.remove('b');
      http.expectOne('/v1/comments/b').flush(
        { error: { code: 'NOT_FOUND', message: 'Comment was not found.', requestId: 'r' } },
        { status: 404, statusText: 'Not Found' },
      );
      await removing;

      expect(store.items().map((comment) => comment.id)).toEqual(['a']);
      expect(store.total()).toBe(1);
      expect(store.moreError()).toBeNull();
    });
  });
});
