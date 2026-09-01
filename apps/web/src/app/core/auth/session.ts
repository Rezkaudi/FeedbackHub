import { Injectable, inject, signal, type Signal } from '@angular/core';
import { DOCUMENT } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BootstrapStore } from '../bootstrap/bootstrap.store';

/**
 * Signing in and out.
 *
 * There is almost nothing here, and that is the point. The handshake — code,
 * PKCE, the token swap — happens entirely on our server (R-3a), with a
 * confidential client whose secret never leaves it (R-3b). The browser only
 * follows redirects and never receives a token in any form (R-3c).
 *
 * So there is no OIDC library in this app, no token to store, and nothing in
 * JavaScript for a script on this page to steal. Signing in is a navigation.
 */
const RETURN_URL_KEY = 'fh.returnUrl';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private readonly bootstrap = inject(BootstrapStore);
  private readonly signedOut = signal(false);

  /** Set when a renewal failed mid-session, so the shell can react. */
  public readonly hasSignedOut: Signal<boolean> = this.signedOut.asReadonly();

  /**
   * SRS 15.8: "back to sign-in, and we remember which page they wanted."
   *
   * The page is kept in session storage rather than passed through the
   * handshake: it would otherwise have to survive a round trip through Keycloak
   * as a parameter we control but do not verify, which is how open-redirect
   * bugs are built. A path this app wrote, read back by this app, cannot send
   * anyone off-site.
   */
  public signIn(returnUrl?: string): void {
    if (returnUrl !== undefined && returnUrl.startsWith('/')) {
      try {
        sessionStorage.setItem(RETURN_URL_KEY, returnUrl);
      } catch {
        /* Losing it means landing on the board. Not worth failing sign-in. */
      }
    }

    this.document.defaultView?.location.assign('/v1/auth/sign-in');
  }

  /** The page they wanted before they were sent to sign in, used once. */
  public takeReturnUrl(): string | null {
    try {
      const url = sessionStorage.getItem(RETURN_URL_KEY);
      sessionStorage.removeItem(RETURN_URL_KEY);
      return url !== null && url.startsWith('/') ? url : null;
    } catch {
      return null;
    }
  }

  /**
   * A renewal failed. The cookies are already cleared by the server.
   *
   * SRS 15.8: a session that was working and then could not be renewed sends
   * the person back to sign-in, remembering the page they wanted — the person
   * never sees the raw 401. But the very first `/v1/bootstrap` on a fresh visit
   * also 401s, and that person is not signed out of anything: they are a
   * visitor who should just see the public board. So the redirect only happens
   * once the app has finished starting up (`status() === 'ready'`).
   *
   * Returns whether it redirected, so the interceptor knows to swallow the
   * error instead of letting a store show a "could not be saved" message.
   */
  public markSignedOut(): boolean {
    if (this.signedOut()) {
      return this.bootstrap.status() === 'ready';
    }
    this.signedOut.set(true);

    if (this.bootstrap.status() !== 'ready') {
      return false;
    }

    const view = this.document.defaultView;
    const returnUrl = view ? view.location.pathname + view.location.search : undefined;
    this.signIn(returnUrl);
    return true;
  }

  /**
   * R-9: clears the app and ends the session at the identity provider too.
   *
   * A request, not a navigation. This used to be
   * `location.assign('/v1/auth/sign-out')`, and it was broken: that is a GET,
   * the route is a POST, so the browser was shown a raw JSON 404 — and the
   * cookies were never cleared, which meant the person was still signed in
   * while looking at a page that said "Not found".
   *
   * A GET would have been the smaller change and is the wrong one. Sign-out
   * ends a session, and the Origin check that stops another site making that
   * happen only guards writes (R-3g) — a GET sign-out is a URL any page could
   * put in an `<img>` tag to log our people out. It does not need to be a
   * navigation either: the provider's session is ended from our server by a
   * back-channel revoke, not by sending the browser anywhere.
   *
   * Then a full page load, deliberately, rather than a router navigation: it
   * throws away every store in memory, so nothing of the last person survives
   * into the next sign-in. The guard finds no session and sends them on to the
   * identity provider.
   */
  public async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/v1/auth/sign-out', {}));
    } catch {
      // The server could not be reached, or refused. Go anyway: staying on a
      // page that is half signed out is worse than arriving at the sign-in
      // screen. If the cookies really did survive, the guard will let them
      // straight back in, which is honest — the sign-out did not happen.
    }

    this.signedOut.set(true);
    this.document.defaultView?.location.assign('/');
  }
}
