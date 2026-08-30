import { Injectable, inject, signal, type Signal } from '@angular/core';
import { DOCUMENT } from '@angular/core';

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

  /** A renewal failed. The cookies are already cleared by the server. */
  public markSignedOut(): void {
    this.signedOut.set(true);
  }

  /** R-9: clears the app and ends the session at the identity provider too. */
  public signOut(): void {
    this.document.defaultView?.location.assign('/v1/auth/sign-out');
  }
}
