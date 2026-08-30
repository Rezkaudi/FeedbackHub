import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SettingsStore } from './settings.store';

/**
 * My settings (R-54 to R-62).
 *
 * The split is the point, and it comes from D-06: language and email choices
 * live on the server, because the worker writes an email at the moment an event
 * happens and must know the person's language even while they are signed out.
 * Theme, default sort and default filters live in this browser, because they
 * belong to a screen rather than to a person and should not follow anybody onto
 * a shared machine.
 *
 * So this store only ever talks to the server about the first group. The second
 * never appears in a request at all — which is also what R-60 asks of us from
 * the other side: a person may change only their language and their email
 * choices through the API.
 */
describe('my settings', () => {
  let store: SettingsStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SettingsStore],
    });
    store = TestBed.inject(SettingsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('my name and picture (R-54)', () => {
    it('saves them, and says so', async () => {
      const done = store.saveProfile({ displayName: 'Sam Smith', avatarUrl: null });

      const request = http.expectOne('/v1/me');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ displayName: 'Sam Smith', avatarUrl: null });

      request.flush({ id: 'u1', email: 's@x.io', displayName: 'Sam Smith', avatarUrl: null, role: 'user' });
      await done;

      expect(store.profileSaved()).toBe(true);
      expect(store.profileError()).toBeNull();
    });

    /** SRS 15.6: "The old value comes back on screen, with a message." */
    it('reports a failure rather than pretending it saved', async () => {
      const done = store.saveProfile({ displayName: '', avatarUrl: null });
      http.expectOne('/v1/me').flush(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Not valid.',
            requestId: 'r',
            fields: { displayName: 'displayName should not be empty' },
          },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await done;

      expect(store.profileSaved()).toBe(false);
      expect(store.profileError()?.fields?.['displayName']).toBeDefined();
    });

    it('sends no picture as null rather than as an empty string', async () => {
      const done = store.saveProfile({ displayName: 'Sam', avatarUrl: '' });

      const request = http.expectOne('/v1/me');
      // An empty string is a picture whose address is nothing; null is "I have
      // no picture, draw my initials" (R-54). They are different claims.
      expect((request.request.body as { avatarUrl: unknown }).avatarUrl).toBeNull();

      request.flush({ id: 'u1', email: 's@x.io', displayName: 'Sam', avatarUrl: null, role: 'user' });
      await done;
    });
  });

  describe('my language and email choices (R-57, R-59)', () => {
    it('saves them on the server, because an email is written while I am away', async () => {
      const done = store.saveSettings({
        language: 'ar',
        notifyOnComment: false,
        notifyOnStatusChange: true,
      });

      const request = http.expectOne('/v1/settings/me');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({
        language: 'ar',
        notifyOnComment: false,
        notifyOnStatusChange: true,
      });

      request.flush({ language: 'ar', notifyOnComment: false, notifyOnStatusChange: true });
      await done;

      expect(store.settingsSaved()).toBe(true);
    });

    /**
     * R-60: a person may change only a fixed list of their own settings. Sending
     * a theme would be refused with a message rather than quietly ignored — so
     * we must never send one, and this test is what keeps that honest as the
     * shape grows.
     */
    it('never sends a theme, a sort or a filter to the server', async () => {
      const done = store.saveSettings({
        language: 'en',
        notifyOnComment: true,
        notifyOnStatusChange: true,
      });

      const request = http.expectOne('/v1/settings/me');
      const body = request.request.body as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual([
        'language',
        'notifyOnComment',
        'notifyOnStatusChange',
      ]);

      request.flush({ language: 'en', notifyOnComment: true, notifyOnStatusChange: true });
      await done;
    });
  });

  describe('deleting my account (R-61, R-62)', () => {
    it('asks the server and reports that it worked', async () => {
      const done = store.deleteAccount();

      const request = http.expectOne('/v1/me');
      expect(request.request.method).toBe('DELETE');

      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(await done).toBe(true);
    });

    /**
     * R-62: the app must never be left with nobody who can run it. The server
     * answers 409 with the reason, and the screen has to show that reason
     * rather than a generic failure.
     */
    it('reports the refusal when I am the last admin', async () => {
      const done = store.deleteAccount();
      http.expectOne('/v1/me').flush(
        {
          error: {
            code: 'CONFLICT',
            message: 'You are the only admin, so this account cannot be deleted.',
            requestId: 'r',
          },
        },
        { status: 409, statusText: 'Conflict' },
      );

      expect(await done).toBe(false);
      expect(store.deleteError()?.status).toBe(409);
    });
  });

  /**
   * SRS 15.6: "Each part saves on its own and says 'Saved'." A failure in one
   * part must not blank the others or make them look unsaved.
   */
  it('keeps each part’s outcome separate', async () => {
    const profile = store.saveProfile({ displayName: 'Sam', avatarUrl: null });
    http
      .expectOne('/v1/me')
      .flush({ id: 'u1', email: 's@x.io', displayName: 'Sam', avatarUrl: null, role: 'user' });
    await profile;

    const settings = store.saveSettings({
      language: 'en',
      notifyOnComment: true,
      notifyOnStatusChange: true,
    });
    http
      .expectOne('/v1/settings/me')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await settings;

    expect(store.profileSaved()).toBe(true);
    expect(store.settingsSaved()).toBe(false);
    expect(store.settingsError()).not.toBeNull();
    expect(store.profileError()).toBeNull();
  });
});
