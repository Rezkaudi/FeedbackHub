import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { refreshInterceptor } from './refresh.interceptor';
import { Session } from './session';

/**
 * R-9a: the access token lives one day and the identity provider rotates
 * the refresh token on every use. SRS 15.8 says what a person should notice
 * when it expires mid-use: nothing. "It is renewed quietly. If that fails, back
 * to sign-in, and we remember which page they wanted."
 *
 * The browser holds no token (R-3c), so this is not a header being rewritten —
 * it is one call to /v1/auth/refresh, which swaps the cookies server-side, and
 * then the original request sent again.
 *
 * The case that makes this worth testing: a page that fires three requests at
 * once, all of which 401 together. Three refreshes would rotate the refresh
 * token three times, and with rotation on, the second and third are replaying a
 * token the provider has already retired — which ends the session it was trying
 * to save. So concurrent failures must share one refresh.
 */
describe('renewing the session quietly', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: { signIn: ReturnType<typeof vi.fn>; markSignedOut: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    session = { signIn: vi.fn(), markSignedOut: vi.fn().mockReturnValue(false) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([refreshInterceptor])),
        provideHttpClientTesting(),
        { provide: Session, useValue: session },
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function unauthorized() {
    return { status: 401, statusText: 'Unauthorized' };
  }

  it('renews and sends the original request again, so the caller never sees the 401', async () => {
    const result = firstValueFrom(http.get('/v1/requests'));

    backend.expectOne('/v1/requests').flush({}, unauthorized());
    backend.expectOne({ url: '/v1/auth/refresh', method: 'POST' }).flush(null, { status: 204, statusText: 'No Content' });
    backend.expectOne('/v1/requests').flush({ items: [], total: 0 });

    await expect(result).resolves.toEqual({ items: [], total: 0 });
  });

  it('keeps the method and the body when it sends the request again', async () => {
    const result = firstValueFrom(http.post('/v1/requests', { title: 'Dark mode' }));

    backend.expectOne('/v1/requests').flush({}, unauthorized());
    backend.expectOne('/v1/auth/refresh').flush(null, { status: 204, statusText: 'No Content' });

    const replayed = backend.expectOne('/v1/requests');
    expect(replayed.request.method).toBe('POST');
    expect(replayed.request.body).toEqual({ title: 'Dark mode' });
    replayed.flush({ id: 'r1' });

    await expect(result).resolves.toEqual({ id: 'r1' });
  });

  it('refreshes once for three requests that fail together, not three times', async () => {
    const results = [
      firstValueFrom(http.get('/v1/requests')),
      firstValueFrom(http.get('/v1/bootstrap')),
      firstValueFrom(http.get('/v1/settings/me')),
    ];

    backend.expectOne('/v1/requests').flush({}, unauthorized());
    backend.expectOne('/v1/bootstrap').flush({}, unauthorized());
    backend.expectOne('/v1/settings/me').flush({}, unauthorized());

    // One refresh, shared. Three would rotate the token three times and end the
    // very session this is trying to save.
    backend.expectOne('/v1/auth/refresh').flush(null, { status: 204, statusText: 'No Content' });

    backend.expectOne('/v1/requests').flush({ items: [] });
    backend.expectOne('/v1/bootstrap').flush({ user: {} });
    backend.expectOne('/v1/settings/me').flush({ language: 'en' });

    await expect(Promise.all(results)).resolves.toHaveLength(3);
  });

  describe('when renewing does not work', () => {
    it('gives the caller the original 401, not the refresh failure', async () => {
      const result = firstValueFrom(http.get('/v1/requests'));

      backend.expectOne('/v1/requests').flush({}, unauthorized());
      backend.expectOne('/v1/auth/refresh').flush({}, unauthorized());

      await expect(result).rejects.toMatchObject({ status: 401, url: '/v1/requests' });
    });

    it('remembers the page they wanted and sends them to sign in', async () => {
      const result = firstValueFrom(http.get('/v1/requests'));

      backend.expectOne('/v1/requests').flush({}, unauthorized());
      backend.expectOne('/v1/auth/refresh').flush({}, unauthorized());
      await result.catch(() => undefined);

      expect(session.markSignedOut).toHaveBeenCalled();
    });

    it('swallows the error when it is redirecting to sign in, so no store shows a failure', async () => {
      // A mid-session expiry: markSignedOut redirects and reports it did.
      session.markSignedOut.mockReturnValue(true);

      let settled = false;
      const result = firstValueFrom(http.get('/v1/requests')).then(
        () => (settled = true),
        () => (settled = true),
      );

      backend.expectOne('/v1/requests').flush({}, unauthorized());
      backend.expectOne('/v1/auth/refresh').flush({}, unauthorized());

      // The page is navigating away; the request stays pending and never
      // rejects, so nothing downstream turns it into an error message.
      await Promise.race([result, Promise.resolve()]);
      expect(settled).toBe(false);
      backend.verify();
    });
  });

  describe('what it must never do', () => {
    /** Refreshing a failed refresh is an endless loop against the provider. */
    it('does not try to refresh the refresh call itself', async () => {
      const result = firstValueFrom(http.post('/v1/auth/refresh', null));

      backend.expectOne('/v1/auth/refresh').flush({}, unauthorized());

      await expect(result).rejects.toMatchObject({ status: 401 });
      backend.verify();
    });

    it('does not try to refresh a sign-out', async () => {
      const result = firstValueFrom(http.post('/v1/auth/sign-out', null));

      backend.expectOne('/v1/auth/sign-out').flush({}, unauthorized());

      await expect(result).rejects.toMatchObject({ status: 401 });
      backend.verify();
    });

    /**
     * 403 is "you are signed in and still not allowed" (R-6). Refreshing would
     * turn a permission refusal into a session problem and hide the real one.
     */
    it('leaves a 403 alone', async () => {
      const result = firstValueFrom(http.get('/v1/invitations'));

      backend.expectOne('/v1/invitations').flush({}, { status: 403, statusText: 'Forbidden' });

      await expect(result).rejects.toMatchObject({ status: 403 });
      backend.verify();
    });

    it('leaves a 500 alone', async () => {
      const result = firstValueFrom(http.get('/v1/requests'));

      backend.expectOne('/v1/requests').flush({}, { status: 500, statusText: 'Server Error' });

      await expect(result).rejects.toMatchObject({ status: 500 });
      backend.verify();
    });

    /** A second 401 on the replayed request means renewing did not help. */
    it('gives up rather than looping when the replayed request fails too', async () => {
      const result = firstValueFrom(http.get('/v1/requests'));

      backend.expectOne('/v1/requests').flush({}, unauthorized());
      backend.expectOne('/v1/auth/refresh').flush(null, { status: 204, statusText: 'No Content' });
      backend.expectOne('/v1/requests').flush({}, unauthorized());

      await expect(result).rejects.toMatchObject({ status: 401 });
      backend.verify();
    });
  });

  it('sends the cookies on every call, since they are the only credential', async () => {
    const result = firstValueFrom(http.get('/v1/requests'));

    const request = backend.expectOne('/v1/requests');
    expect(request.request.withCredentials).toBe(true);
    request.flush({});

    await result;
  });
});
