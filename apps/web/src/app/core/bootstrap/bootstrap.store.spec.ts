import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BootstrapStore } from './bootstrap.store';

/**
 * R-52 and hard part H-4: the browser gets everything it needs to start — who I
 * am, my language and email choices, the switches, the categories and the
 * statuses — in **one** call. A chain of calls is a bug.
 *
 * SRS 15.8 adds what must happen when that call does not succeed, and the two
 * cases are different: not signed in is not a failure, it is the normal first
 * visit. A failure gets an error with a Try again button — never a white page
 * and never an endless spinner.
 *
 * The rule that makes both possible: this load never rejects. A rejected app
 * initializer aborts Angular's bootstrap and leaves exactly the blank page SRS
 * 15.8 forbids, so failure is turned into state the shell can render.
 */
describe('the one call the app starts with', () => {
  const payload = {
    user: { id: 'u1', displayName: 'Sam', avatarUrl: null, role: 'user' },
    settings: { language: 'en', notifyOnComment: true, notifyOnStatusChange: false },
    features: { commentsEnabled: true, commentsRequireApproval: false },
    categories: [
      { id: 'c1', name: 'Bug', slug: 'bug', color: '#DC2626', isActive: true },
      { id: 'c2', name: 'Legacy', slug: 'legacy', color: '#78716C', isActive: false },
    ],
    statuses: [
      { id: 's1', name: 'New', slug: 'new', color: '#0369A1', isActive: true, isDefault: true },
    ],
  };

  let store: BootstrapStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), BootstrapStore],
    });
    store = TestBed.inject(BootstrapStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts out loading, so nothing renders a half-built app', () => {
    expect(store.status()).toBe('loading');
  });

  describe('when the call succeeds', () => {
    it('makes exactly one request, and it is the bootstrap one (H-4)', async () => {
      const done = store.load();

      const request = http.expectOne('/v1/bootstrap');
      expect(request.request.method).toBe('GET');
      request.flush(payload);
      await done;

      // Nothing else may be asked for before the app appears. This is the
      // assertion that H-4 lives or dies by.
      http.verify();
    });

    it('sends the cookies, because that is the only credential we have', async () => {
      const done = store.load();
      const request = http.expectOne('/v1/bootstrap');

      expect(request.request.withCredentials).toBe(true);

      request.flush(payload);
      await done;
    });

    it('is ready, and knows who I am', async () => {
      const done = store.load();
      http.expectOne('/v1/bootstrap').flush(payload);
      await done;

      expect(store.status()).toBe('ready');
      expect(store.user()?.displayName).toBe('Sam');
      expect(store.isAdmin()).toBe(false);
    });

    it('knows when I am an admin', async () => {
      const done = store.load();
      http
        .expectOne('/v1/bootstrap')
        .flush({ ...payload, user: { ...payload.user, role: 'admin' } });
      await done;

      expect(store.isAdmin()).toBe(true);
    });

    it('carries the feature switches, so the screen can obey them (R-42)', async () => {
      const done = store.load();
      http
        .expectOne('/v1/bootstrap')
        .flush({ ...payload, features: { commentsEnabled: false, commentsRequireApproval: true } });
      await done;

      expect(store.commentsEnabled()).toBe(false);
      expect(store.commentsRequireApproval()).toBe(true);
    });

    /**
     * R-45: a retired category is gone from the picker but still names the old
     * requests that use it. Both lists arrive whole and are split here, once,
     * rather than at every screen that needs one or the other.
     */
    it('keeps every category for labelling, and offers only the active ones', async () => {
      const done = store.load();
      http.expectOne('/v1/bootstrap').flush(payload);
      await done;

      expect(store.categories().map((category) => category.name)).toEqual(['Bug', 'Legacy']);
      expect(store.activeCategories().map((category) => category.name)).toEqual(['Bug']);
    });

    it('can name a retired category by its id', async () => {
      const done = store.load();
      http.expectOne('/v1/bootstrap').flush(payload);
      await done;

      expect(store.categoryById('c2')?.name).toBe('Legacy');
      expect(store.statusById('s1')?.name).toBe('New');
    });

    it('gives nothing rather than throwing for an id it has never seen', async () => {
      const done = store.load();
      http.expectOne('/v1/bootstrap').flush(payload);
      await done;

      expect(store.categoryById('nope')).toBeUndefined();
    });
  });

  describe('when nobody is signed in', () => {
    it('is signed out, which is not an error', async () => {
      const done = store.load();
      http.expectOne('/v1/bootstrap').flush(
        { error: { code: 'UNAUTHORIZED', message: 'You are not signed in.', requestId: 'r' } },
        { status: 401, statusText: 'Unauthorized' },
      );
      await done;

      expect(store.status()).toBe('signedOut');
      expect(store.error()).toBeNull();
    });

    it('does not reject, so the app still boots and can show the sign-in page', async () => {
      const done = store.load();
      http
        .expectOne('/v1/bootstrap')
        .flush({}, { status: 401, statusText: 'Unauthorized' });

      await expect(done).resolves.toBeUndefined();
    });
  });

  describe('when the call fails', () => {
    it('holds the error so the shell can show it with a Try again button', async () => {
      const done = store.load();
      http
        .expectOne('/v1/bootstrap')
        .flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(store.status()).toBe('failed');
      expect(store.error()?.isRetryable).toBe(true);
    });

    it('never rejects, because a rejected initializer is a blank page', async () => {
      const done = store.load();
      http.expectOne('/v1/bootstrap').flush({}, { status: 500, statusText: 'Server Error' });

      await expect(done).resolves.toBeUndefined();
    });

    it('tries again when asked, and succeeds the second time', async () => {
      const first = store.load();
      http.expectOne('/v1/bootstrap').flush({}, { status: 500, statusText: 'Server Error' });
      await first;
      expect(store.status()).toBe('failed');

      const second = store.load();
      expect(store.status()).toBe('loading');
      http.expectOne('/v1/bootstrap').flush(payload);
      await second;

      expect(store.status()).toBe('ready');
      expect(store.error()).toBeNull();
    });
  });

  /**
   * R-57: language is kept on the server and copied into the browser. The store
   * is where that copy happens, because it is the first thing to learn it.
   */
  it('reports the language the server resolved for me', async () => {
    const done = store.load();
    http.expectOne('/v1/bootstrap').flush({
      ...payload,
      settings: { language: 'ar', notifyOnComment: false, notifyOnStatusChange: true },
    });
    await done;

    expect(store.language()).toBe('ar');
    expect(store.mySettings()?.notifyOnStatusChange).toBe(true);
  });
});
