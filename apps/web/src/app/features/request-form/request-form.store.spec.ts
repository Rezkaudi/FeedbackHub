import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RequestFormStore } from './request-form.store';

/**
 * Writing, changing and deleting a request (R-10 to R-14).
 *
 * R-10 draws the line this store is built around: the person picks a title, a
 * description and a category. The server sets the status, the author, the time
 * and the counts. So there is no status here, no author, and nothing that would
 * let a browser propose one — the API refuses unknown fields outright, and this
 * never sends any.
 */
describe('writing a request', () => {
  let store: RequestFormStore;
  let http: HttpTestingController;

  const saved = {
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
    voteCount: 0,
    commentCount: 0,
    viewerHasVoted: false,
    isMine: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RequestFormStore],
    });
    store = TestBed.inject(RequestFormStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('a new one', () => {
    it('sends only the three fields the person filled in (R-10)', async () => {
      const done = store.create({
        title: 'Dark mode',
        description: 'It is painful at night.',
        categoryId: 'c1',
      });

      const request = http.expectOne('/v1/requests');
      expect(request.request.method).toBe('POST');
      // Nothing else. A statusId or a voteCount here would be refused by the
      // server anyway, and sending one would mean we had misunderstood R-10.
      expect(Object.keys(request.request.body as object).sort()).toEqual([
        'categoryId',
        'description',
        'title',
      ]);

      request.flush(saved);
      await done;
    });

    it('gives back the saved request, so the screen can go to it', async () => {
      const done = store.create({ title: 'Dark mode', description: 'Long enough.', categoryId: 'c1' });
      http.expectOne('/v1/requests').flush(saved);

      expect(await done).toEqual(saved);
    });

    /**
     * SRS 15.3: "Over the limit -> 'You have sent 10 requests in the last hour.
     * You can send another at 14:00.' The text they wrote is kept, not thrown
     * away."
     */
    it('reports a rate limit with the time they may try again (R-131)', async () => {
      const done = store.create({ title: 'Dark mode', description: 'Long enough.', categoryId: 'c1' });
      http.expectOne('/v1/requests').flush(
        {
          error: {
            code: 'SUBMISSION_RATE_LIMITED',
            message: 'Too many.',
            requestId: 'r',
            retryAt: '2026-08-30T14:00:00.000Z',
          },
        },
        { status: 429, statusText: 'Too Many Requests' },
      );

      expect(await done).toBeNull();
      expect(store.error()?.code).toBe('SUBMISSION_RATE_LIMITED');
      expect(store.error()?.retryAt).toEqual(new Date('2026-08-30T14:00:00.000Z'));
    });

    /**
     * SRS 15.3: "The category was retired while the form was open -> a clear
     * message asking them to pick another."
     */
    it('reports the field the server refused, so the message can sit by it', async () => {
      const done = store.create({ title: 'Dark mode', description: 'Long enough.', categoryId: 'gone' });
      http.expectOne('/v1/requests').flush(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The submitted values are not valid.',
            requestId: 'r',
            fields: { categoryId: 'categoryId must be an active category' },
          },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await done;

      expect(store.error()?.fields?.['categoryId']).toBeDefined();
    });

    /** SRS 15.3: "Two fast clicks on Save -> only one request is made." */
    it('ignores a second save while the first is still in flight', async () => {
      const first = store.create({ title: 'Dark mode', description: 'Long enough.', categoryId: 'c1' });
      const second = store.create({ title: 'Dark mode', description: 'Long enough.', categoryId: 'c1' });

      http.expectOne('/v1/requests').flush(saved);
      await Promise.all([first, second]);

      // One call. The second returned without asking again.
      http.verify();
      expect(await second).toBeNull();
    });

    it('lets them save again once the first has finished', async () => {
      const first = store.create({ title: 'Dark mode', description: 'Long enough.', categoryId: 'c1' });
      http.expectOne('/v1/requests').flush(saved);
      await first;

      const second = store.create({ title: 'Another', description: 'Long enough.', categoryId: 'c1' });
      http.expectOne('/v1/requests').flush(saved);

      expect(await second).toEqual(saved);
    });
  });

  describe('changing my own', () => {
    it('sends only what the person may change (R-13)', async () => {
      const done = store.update('r1', {
        title: 'Dark mode everywhere',
        description: 'Still painful.',
        categoryId: 'c2',
      });

      const request = http.expectOne('/v1/requests/r1');
      expect(request.request.method).toBe('PATCH');
      // No statusId: only an admin changes a status, and only through its own
      // endpoint (R-64). Putting one here would be asking to be refused.
      expect(request.request.body).not.toHaveProperty('statusId');

      request.flush(saved);
      await done;
    });

    /** SRS 15.2: someone else's request -> the server answers 403. */
    it('reports a refusal rather than pretending it saved', async () => {
      const done = store.update('r1', { title: 'x', description: 'y', categoryId: 'c1' });
      http
        .expectOne('/v1/requests/r1')
        .flush({}, { status: 403, statusText: 'Forbidden' });

      expect(await done).toBeNull();
      expect(store.error()?.status).toBe(403);
    });
  });

  describe('deleting my own', () => {
    it('asks the server, and says it worked', async () => {
      const done = store.remove('r1');

      const request = http.expectOne('/v1/requests/r1');
      expect(request.request.method).toBe('DELETE');

      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(await done).toBe(true);
    });

    it('says it did not work, rather than navigating away from a live request', async () => {
      const done = store.remove('r1');
      http.expectOne('/v1/requests/r1').flush({}, { status: 403, statusText: 'Forbidden' });

      expect(await done).toBe(false);
      expect(store.error()?.status).toBe(403);
    });

    it('counts an already-deleted request as done, with no error', async () => {
      const done = store.remove('r1');
      http.expectOne('/v1/requests/r1').flush(
        { error: { code: 'NOT_FOUND', message: 'Feedback request was not found.', requestId: 'r' } },
        { status: 404, statusText: 'Not Found' },
      );

      expect(await done).toBe(true);
      expect(store.error()).toBeNull();
    });
  });

  describe('loading one to change it', () => {
    it('fills the form from the saved request', async () => {
      const done = store.load('r1');
      http.expectOne('/v1/requests/r1').flush(saved);
      await done;

      expect(store.state()).toBe('ready');
      expect(store.initial()).toEqual({
        title: 'Dark mode',
        description: 'It is painful at night.',
        categoryId: 'c1',
      });
    });

    /** SRS 15.2: "Someone opens the edit page for a request that is not theirs
     * -> clear message, no form." */
    it('refuses the form for a request that is not mine', async () => {
      const done = store.load('r1');
      http.expectOne('/v1/requests/r1').flush({ ...saved, isMine: false });
      await done;

      expect(store.state()).toBe('notAllowed');
    });

    it('is missing when the request has gone', async () => {
      const done = store.load('r1');
      http.expectOne('/v1/requests/r1').flush({}, { status: 404, statusText: 'Not Found' });
      await done;

      expect(store.state()).toBe('missing');
    });
  });
});
