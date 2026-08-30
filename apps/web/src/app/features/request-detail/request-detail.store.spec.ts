import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RequestDetailStore } from './request-detail.store';

/**
 * The request page, and the vote on it.
 *
 * R-30: "the number changes at once when clicked. If the server says no, it
 * goes back and shows why." R-28 is the other half and it is what makes the
 * rollback correct rather than a guess: the count is the server's, always, so
 * the optimistic number is only ever a prediction and the answer replaces it
 * outright rather than being added to it.
 *
 * R-27 is the reason a double click must be harmless: voting twice gives back
 * the current state instead of an error, so a person who clicks fast never has
 * to understand a race they did not cause.
 */
describe('a request and its vote', () => {
  const REQUEST = 'r1';

  let store: RequestDetailStore;
  let http: HttpTestingController;

  const aRequest = (over: Record<string, unknown> = {}) => ({
    id: REQUEST,
    title: 'Dark mode',
    description: 'It is painful at night.',
    categoryId: 'c1',
    statusId: 's1',
    authorName: 'Sam',
    authorAvatarUrl: null,
    isPinned: false,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    voteCount: 4,
    commentCount: 2,
    viewerHasVoted: false,
    isMine: false,
    ...over,
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RequestDetailStore],
    });
    store = TestBed.inject(RequestDetailStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function loadReady(over: Record<string, unknown> = {}) {
    const done = store.load(REQUEST);
    http.expectOne(`/v1/requests/${REQUEST}`).flush(aRequest(over));
    await done;
  }

  describe('loading the request', () => {
    it('is loading, then ready with the request', async () => {
      const done = store.load(REQUEST);
      expect(store.state()).toBe('loading');

      http.expectOne(`/v1/requests/${REQUEST}`).flush(aRequest());
      await done;

      expect(store.state()).toBe('ready');
      expect(store.request()?.title).toBe('Dark mode');
    });

    /** SRS 15.2: deleted while it was open, or a bad address. */
    it('is missing, not failed, when the request is not there', async () => {
      const done = store.load(REQUEST);
      http
        .expectOne(`/v1/requests/${REQUEST}`)
        .flush({}, { status: 404, statusText: 'Not Found' });
      await done;

      expect(store.state()).toBe('missing');
    });

    it('is failed, with a retry, when the server broke', async () => {
      const done = store.load(REQUEST);
      http
        .expectOne(`/v1/requests/${REQUEST}`)
        .flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(store.state()).toBe('failed');
      expect(store.error()?.isRetryable).toBe(true);
    });
  });

  describe('voting', () => {
    it('moves the number before the server has answered (R-30)', async () => {
      await loadReady();

      void store.vote();

      // Not after the answer — now, while the call is still in flight.
      expect(store.voteCount()).toBe(5);
      expect(store.viewerHasVoted()).toBe(true);

      http.expectOne(`/v1/requests/${REQUEST}/vote`).flush({ voteCount: 5, viewerHasVoted: true });
    });

    /**
     * R-28: the count is counted by the server from the real votes, and the
     * browser can never send one. So the answer replaces the prediction rather
     * than confirming it — if somebody else voted in between, the server's
     * number is right and ours was not.
     */
    it('takes the server number even when it differs from the prediction', async () => {
      await loadReady();

      const done = store.vote();
      http.expectOne(`/v1/requests/${REQUEST}/vote`).flush({ voteCount: 9, viewerHasVoted: true });
      await done;

      expect(store.voteCount()).toBe(9);
    });

    it('puts the number back when the server says no (R-30)', async () => {
      await loadReady();

      const done = store.vote();
      expect(store.voteCount()).toBe(5);

      http
        .expectOne(`/v1/requests/${REQUEST}/vote`)
        .flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(store.voteCount()).toBe(4);
      expect(store.viewerHasVoted()).toBe(false);
      expect(store.voteError()).not.toBeNull();
    });

    it('says when they may vote again if a limit refused it (R-131)', async () => {
      await loadReady();

      const done = store.vote();
      http.expectOne(`/v1/requests/${REQUEST}/vote`).flush(
        {
          error: {
            code: 'VOTE_RATE_LIMITED',
            message: 'Too many.',
            requestId: 'r',
            retryAt: '2026-08-30T14:00:00.000Z',
          },
        },
        { status: 429, statusText: 'Too Many Requests' },
      );
      await done;

      expect(store.voteCount()).toBe(4);
      expect(store.voteError()?.retryAt).toEqual(new Date('2026-08-30T14:00:00.000Z'));
    });

    describe('taking it back', () => {
      it('moves the number down at once, and back up if refused', async () => {
        await loadReady({ voteCount: 4, viewerHasVoted: true });

        const done = store.vote();
        expect(store.voteCount()).toBe(3);
        expect(store.viewerHasVoted()).toBe(false);

        http
          .expectOne(`/v1/requests/${REQUEST}/vote`)
          .flush({}, { status: 500, statusText: 'Server Error' });
        await done;

        expect(store.voteCount()).toBe(4);
        expect(store.viewerHasVoted()).toBe(true);
      });

      it('sends a DELETE, not a POST, when a vote is already there', async () => {
        await loadReady({ viewerHasVoted: true });

        const done = store.vote();
        const request = http.expectOne(`/v1/requests/${REQUEST}/vote`);

        expect(request.request.method).toBe('DELETE');

        request.flush({ voteCount: 3, viewerHasVoted: false });
        await done;
      });
    });

    /**
     * SRS 15.4: "Double click -> still one vote. No error message the person has
     * to understand."
     *
     * The database is what actually guarantees one vote (R-26). What the screen
     * must add is not sending a second call that would flip the state back.
     */
    it('ignores a second click while the first is still in flight', async () => {
      await loadReady();

      void store.vote();
      void store.vote();

      // One call, not two. A second would be an un-vote and would undo the first.
      const request = http.expectOne(`/v1/requests/${REQUEST}/vote`);
      request.flush({ voteCount: 5, viewerHasVoted: true });
      await settle();

      expect(store.voteCount()).toBe(5);
    });

    it('lets them vote again once the first call has finished', async () => {
      await loadReady();

      const first = store.vote();
      http.expectOne(`/v1/requests/${REQUEST}/vote`).flush({ voteCount: 5, viewerHasVoted: true });
      await first;

      const second = store.vote();
      http.expectOne(`/v1/requests/${REQUEST}/vote`).flush({ voteCount: 4, viewerHasVoted: false });
      await second;

      expect(store.voteCount()).toBe(4);
    });

    /** SRS 15.4: the request was deleted a second ago -> a clear message. */
    it('marks the request gone when voting finds it deleted', async () => {
      await loadReady();

      const done = store.vote();
      http
        .expectOne(`/v1/requests/${REQUEST}/vote`)
        .flush({}, { status: 404, statusText: 'Not Found' });
      await done;

      expect(store.state()).toBe('missing');
    });

    it('clears an old vote error when the next vote succeeds', async () => {
      await loadReady();

      const failed = store.vote();
      http
        .expectOne(`/v1/requests/${REQUEST}/vote`)
        .flush({}, { status: 500, statusText: 'Server Error' });
      await failed;
      expect(store.voteError()).not.toBeNull();

      const ok = store.vote();
      http.expectOne(`/v1/requests/${REQUEST}/vote`).flush({ voteCount: 5, viewerHasVoted: true });
      await ok;

      expect(store.voteError()).toBeNull();
    });
  });
});

/**
 * R-64 and R-65: only an admin changes a status or pins, and both show at once.
 * The screen hides the controls from everybody else as a courtesy; the server
 * refuses them either way (R-70), which the E2E suite proves separately.
 */
describe('what an admin changes on a request', () => {
  let store: RequestDetailStore;
  let http: HttpTestingController;

  const row = {
    id: 'r1',
    title: 'Dark mode',
    description: 'It is painful at night.',
    categoryId: 'c1',
    statusId: 's1',
    authorName: 'Sam',
    authorAvatarUrl: null,
    isPinned: false,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    voteCount: 4,
    commentCount: 2,
    viewerHasVoted: false,
    isMine: false,
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RequestDetailStore],
    });
    store = TestBed.inject(RequestDetailStore);
    http = TestBed.inject(HttpTestingController);

    const done = store.load('r1');
    http.expectOne('/v1/requests/r1').flush(row);
    await done;
  });

  afterEach(() => http.verify());

  it('changes the status and shows the new one at once', async () => {
    const done = store.changeStatus('s2');

    const request = http.expectOne('/v1/requests/r1/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ statusId: 's2' });

    request.flush({ ...row, statusId: 's2' });

    expect(await done).toBe(true);
    expect(store.request()?.statusId).toBe('s2');
  });

  it('pins and unpins', async () => {
    const pinning = store.setPinned(true);
    const request = http.expectOne('/v1/requests/r1/pin');
    expect(request.request.body).toEqual({ pinned: true });
    request.flush({ ...row, isPinned: true });
    await pinning;

    expect(store.request()?.isPinned).toBe(true);
  });

  it('leaves the row exactly as it was when the server refuses', async () => {
    const done = store.changeStatus('s2');
    http.expectOne('/v1/requests/r1/status').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(await done).toBe(false);
    expect(store.request()?.statusId).toBe('s1');
    expect(store.adminError()?.status).toBe(403);
  });
});
