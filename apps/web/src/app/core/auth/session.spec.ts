import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Session } from './session';

/**
 * R-9, and the bug that made this file exist.
 *
 * Sign-out used to be `location.assign('/v1/auth/sign-out')` — a GET at a route
 * that is a POST. The person was shown the API's raw JSON 404 and, because the
 * server never ran, their cookies were left in place: signed in, on a page that
 * said "Not found". Nothing at any test layer would have noticed, because
 * nothing called `signOut` at all.
 *
 * So the two things asserted here are the two things that were wrong: it is a
 * POST, and the browser is sent back into the app rather than at the endpoint.
 */
describe('signing out', () => {
  let session: Session;
  let http: HttpTestingController;
  const location = { assign: vi.fn() };

  beforeEach(() => {
    location.assign.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: DOCUMENT,
          useValue: { defaultView: { location } },
        },
      ],
    });

    session = TestBed.inject(Session);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks the server to end the session, with a POST', async () => {
    const done = session.signOut();

    const call = http.expectOne('/v1/auth/sign-out');
    // The method is the whole bug. A GET is a 404 here, and a GET that ends a
    // session is also something any other site could trigger with an <img>
    // tag — the Origin check only guards writes (R-3g).
    expect(call.request.method).toBe('POST');
    call.flush(null, { status: 204, statusText: 'No Content' });

    await done;
  });

  it('reloads the app afterwards, so nothing of the last person is left in memory', async () => {
    const done = session.signOut();
    http.expectOne('/v1/auth/sign-out').flush(null, { status: 204, statusText: 'No Content' });
    await done;

    // Back to the app, not to the endpoint. The guard takes it from here.
    expect(location.assign).toHaveBeenCalledWith('/');
    expect(session.hasSignedOut()).toBe(true);
  });

  it('still sends them away when the server refuses', async () => {
    const done = session.signOut();
    http
      .expectOne('/v1/auth/sign-out')
      .flush({ error: {} }, { status: 500, statusText: 'Server Error' });
    await done;

    // Leaving somebody on a half-signed-out screen is worse than putting them
    // at the sign-in page.
    expect(location.assign).toHaveBeenCalledWith('/');
  });

  it('sends them to the provider to sign in, and remembers where they wanted to go', () => {
    session.signIn('/requests/abc');

    expect(sessionStorage.getItem('fh.returnUrl')).toBe('/requests/abc');
    expect(location.assign).toHaveBeenCalledWith('/v1/auth/sign-in');
    expect(session.takeReturnUrl()).toBe('/requests/abc');
    // Used once: a second read must not send them back there again.
    expect(session.takeReturnUrl()).toBeNull();
  });

  it('refuses a return url that is not a path on this site', () => {
    session.signIn('https://evil.example/steal');

    expect(session.takeReturnUrl()).toBeNull();
  });
});
