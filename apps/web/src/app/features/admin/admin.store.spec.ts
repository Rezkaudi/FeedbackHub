import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminStore } from './admin.store';

/**
 * Admin work (R-43 to R-49, R-64 to R-70).
 *
 * The refusals carry as much weight as the actions here. SRS 15.7 lists three
 * that are blocked on purpose, and each has to reach the person as a reason
 * they can act on: retire the first status, retire the last category, delete a
 * taxonomy row something still uses. The last one even names the way out —
 * "offer to retire instead".
 */
describe('admin work', () => {
  let store: AdminStore;
  let http: HttpTestingController;

  const taxonomy = {
    categories: [
      { id: 'c1', name: 'Bug', slug: 'bug', color: '#DC2626', description: null, isActive: true, usageCount: 4 },
    ],
    statuses: [
      { id: 's1', name: 'New', slug: 'new', color: '#0369A1', isDefault: true, isActive: true, usageCount: 9 },
    ],
  };

  const settings = {
    registrationPolicy: 'open',
    allowedEmailDomains: [],
    commentsRequireApproval: false,
    featureCommentsEnabled: true,
    signupLimitCount: 20,
    signupLimitMinutes: 60,
    submissionLimitCount: 10,
    submissionLimitMinutes: 60,
    voteLimitCount: 100,
    voteLimitMinutes: 60,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AdminStore],
    });
    store = TestBed.inject(AdminStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * Every action re-reads after it succeeds, and that GET is issued one
   * microtask after the action's answer. Without draining the queue first, the
   * test looks for it before it exists.
   */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  describe('the two lists', () => {
    it('reads them with the count of what uses each one (SRS part 7)', async () => {
      const done = store.loadTaxonomy();
      http.expectOne('/v1/taxonomy').flush(taxonomy);
      await done;

      expect(store.state()).toBe('ready');
      expect(store.categories()[0]?.usageCount).toBe(4);
      expect(store.statuses()[0]?.usageCount).toBe(9);
    });

    /**
     * R-47: marking a new first status un-marks the old one, in the same step.
     * We re-read rather than flipping the flag locally, because working out
     * which row lost the mark would be a second copy of a rule the server owns.
     */
    it('re-reads after making a status the first one, instead of guessing', async () => {
      const done = store.makeDefaultStatus('s2');

      http
        .expectOne('/v1/taxonomy/statuses/s2/make-default')
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();
      http.expectOne('/v1/taxonomy').flush(taxonomy);

      expect(await done).toBe(true);
    });

    /** SRS 15.7: refused, with the reason. R-48. */
    it('reports the refusal when the first status cannot be retired', async () => {
      const done = store.retireStatus('s1');
      http.expectOne('/v1/taxonomy/statuses/s1/retire').flush(
        { error: { code: 'CONFLICT', message: 'The first status cannot be retired.', requestId: 'r' } },
        { status: 409, statusText: 'Conflict' },
      );

      expect(await done).toBe(false);
      expect(store.actionError()?.status).toBe(409);
    });

    /** R-46: refused, and retiring is the way out. */
    it('reports the refusal when a category is still in use', async () => {
      const done = store.deleteCategory('c1');
      http.expectOne('/v1/taxonomy/categories/c1').flush(
        { error: { code: 'CONFLICT', message: 'Something still uses it.', requestId: 'r' } },
        { status: 409, statusText: 'Conflict' },
      );

      expect(await done).toBe(false);
      expect(store.actionError()?.code).toBe('CONFLICT');
    });

    it('leaves the rows alone when an action fails, so nothing half-changes', async () => {
      const read = store.loadTaxonomy();
      http.expectOne('/v1/taxonomy').flush(taxonomy);
      await read;

      const done = store.retireCategory('c1');
      http
        .expectOne('/v1/taxonomy/categories/c1/retire')
        .flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(store.categories()[0]?.isActive).toBe(true);
      expect(store.state()).toBe('ready');
    });
  });

  describe('the application settings', () => {
    it('reads them', async () => {
      const done = store.loadSettings();
      http.expectOne('/v1/settings/app').flush(settings);
      await done;

      expect(store.settings()?.submissionLimitCount).toBe(10);
    });

    /**
     * R-42 and hard part H-5: turning comments off is a real switch. The screen
     * obeys it and so does the server — this is the half that asks.
     */
    it('turns the comments feature off, and re-reads what the server now says', async () => {
      const done = store.saveSettings({ featureCommentsEnabled: false });

      const request = http.expectOne('/v1/settings/app');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ featureCommentsEnabled: false });
      request.flush({ ...settings, featureCommentsEnabled: false });
      await settle();

      http.expectOne('/v1/settings/app').flush({ ...settings, featureCommentsEnabled: false });
      expect(await done).toBe(true);
      expect(store.settings()?.featureCommentsEnabled).toBe(false);
    });

    /** R-69: the limits change while the app runs, with no restart. */
    it('changes a rate limit', async () => {
      const done = store.saveSettings({ submissionLimitCount: 3 });

      http.expectOne('/v1/settings/app').flush({ ...settings, submissionLimitCount: 3 });
      await settle();
      http.expectOne('/v1/settings/app').flush({ ...settings, submissionLimitCount: 3 });
      await done;

      expect(store.settings()?.submissionLimitCount).toBe(3);
    });

    /** SRS 15.7: "the old value stays on screen with a message. No half-saved." */
    it('keeps the old values on screen when a save fails', async () => {
      const read = store.loadSettings();
      http.expectOne('/v1/settings/app').flush(settings);
      await read;

      const done = store.saveSettings({ submissionLimitCount: 0 });
      http
        .expectOne('/v1/settings/app')
        .flush({}, { status: 400, statusText: 'Bad Request' });
      await done;

      expect(store.settings()?.submissionLimitCount).toBe(10);
      expect(store.actionError()).not.toBeNull();
    });
  });

  describe('moderation and invites', () => {
    /** R-41: approve makes it appear; reject turns it into the grey line. */
    it('approves a waiting comment and re-reads the queue', async () => {
      const done = store.approveComment('k1');

      http
        .expectOne('/v1/admin/comments/k1/approve')
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();
      http.expectOne('/v1/admin/comments/pending').flush([]);

      expect(await done).toBe(true);
      expect(store.pending()).toHaveLength(0);
    });

    it('rejects one', async () => {
      const done = store.rejectComment('k1');
      http
        .expectOne('/v1/admin/comments/k1/reject')
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();
      http.expectOne('/v1/admin/comments/pending').flush([]);

      expect(await done).toBe(true);
    });

    /** R-66: only an admin, and the server checks the saved row every time. */
    it('invites an address and re-reads the list', async () => {
      const done = store.invite('new@example.com');

      const request = http.expectOne('/v1/invitations');
      expect(request.request.body).toEqual({ email: 'new@example.com' });
      request.flush({ id: 'i1', email: 'new@example.com', acceptedAt: null, createdAt: 'now' });
      await settle();

      http.expectOne('/v1/invitations').flush([
        { id: 'i1', email: 'new@example.com', acceptedAt: null, createdAt: 'now' },
      ]);

      expect(await done).toBe(true);
      expect(store.invitations()).toHaveLength(1);
    });

    it('reports a 403 rather than pretending, if a non-admin ever got here', async () => {
      const done = store.invite('x@example.com');
      http.expectOne('/v1/invitations').flush({}, { status: 403, statusText: 'Forbidden' });

      expect(await done).toBe(false);
      expect(store.actionError()?.status).toBe(403);
    });
  });
});
