import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import {
  NEVER,
  Observable,
  catchError,
  filter,
  finalize,
  shareReplay,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { Session } from './session';

/**
 * R-9a and SRS 15.8: the access token lives one day, and when it runs out the
 * person should notice nothing. One call to /v1/auth/refresh swaps the cookies
 * on the server, and the original request goes again. When the refresh token
 * has also run out (one week), the renewal fails and the person is sent back to
 * sign-in — never shown the raw 401.
 *
 * There is no header to rewrite here. The browser holds no token (R-3c) — the
 * cookies do all of it, which is why every request goes out with credentials
 * and why this interceptor only has to decide *when* to renew.
 */

/**
 * The auth routes are excluded, and they have to be. Refreshing a failed
 * refresh is an endless loop against the identity provider, and refreshing a
 * sign-out would re-establish the session the person just ended.
 */
const NEVER_REFRESH = ['/v1/auth/refresh', '/v1/auth/sign-out', '/v1/auth/sign-in'];

/**
 * One shared renewal, not one per failed request.
 *
 * The identity provider rotates the refresh token on every use (R-9a). Three
 * requests failing together and each firing its own refresh would replay a
 * token the provider has already retired, and the session this is trying to
 * save would end instead. Module scope rather than a service because an
 * interceptor is a function: there is one HTTP stack per app, so there is one
 * renewal in flight.
 */
let inFlight: Observable<unknown> | null = null;

function renew(next: HttpHandlerFn, template: HttpRequest<unknown>): Observable<unknown> {
  inFlight ??= next(
    template.clone({
      url: '/v1/auth/refresh',
      method: 'POST',
      body: null,
      withCredentials: true,
    }),
  ).pipe(
    /**
     * `next()` is the whole event stream, not just the answer: it emits a Sent
     * event first and the response after. Without this filter the replay below
     * fires once per event, so a single expiry sends the original request twice
     * — which for a POST means submitting it twice. The test that found this is
     * "renews and sends the original request again".
     */
    filter((event) => event.type === HttpEventType.Response),
    take(1),
    // Clear before the value reaches anyone, so the *next* expiry starts a new
    // renewal. A long-lived tab expires many times.
    finalize(() => {
      inFlight = null;
    }),
    // refCount false: the renewal must finish even if every caller that was
    // waiting for it has since been cancelled by a navigation.
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  return inFlight;
}

export const refreshInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(Session);

  // The cookies are the only credential the browser has, so they go on
  // everything (R-3c). Set once here rather than remembered at every call site.
  const withCookies = request.clone({ withCredentials: true });

  if (NEVER_REFRESH.some((path) => withCookies.url.startsWith(path))) {
    return next(withCookies);
  }

  return next(withCookies).pipe(
    catchError((failure: unknown) => {
      // 403 is "signed in and still not allowed" (R-6). Renewing would turn a
      // permission refusal into a session problem and hide the real reason.
      if (!(failure instanceof HttpErrorResponse) || failure.status !== 401) {
        return throwError(() => failure);
      }

      return renew(next, withCookies).pipe(
        // The renewal worked: send the original request exactly as it was, same
        // method and same body. If *that* answers 401 the error propagates —
        // there is no second renewal, so this cannot loop.
        switchMap(() => next(withCookies)),
        catchError(() => {
          // The session is over. If markSignedOut redirects to sign-in (a
          // mid-session expiry, SRS 15.8), the page is on its way out — hand
          // back a stream that never emits so no store shows an error for a
          // request the person will never see the result of. Otherwise (the
          // first bootstrap of an anonymous visit) let the original 401
          // through, so the bootstrap store can settle on "signed out" and
          // render the public board.
          if (session.markSignedOut()) {
            return NEVER;
          }
          // Deliberately the original 401, not the renewal's. The caller asked
          // for /v1/requests; an error about /v1/auth/refresh would name a call
          // it never made.
          return throwError(() => failure);
        }),
      );
    }),
  );
};
