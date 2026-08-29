import { Response } from 'express';
import { AppEnvironment } from '../../../shared/config/environment';

/**
 * The only place cookies are written or cleared (R-150), so R-3c to R-3f hold
 * everywhere by construction:
 *
 *   R-3c — the browser never receives a token in a body, a header or a URL.
 *          Only these cookies, which script cannot read.
 *   R-3d — HttpOnly and Secure, and no Domain is set, so no other subdomain can
 *          read them.
 *   R-3e — the refresh cookie is scoped to the auth path and SameSite=Strict,
 *          so it reaches the two routes that need it — refresh and sign-out —
 *          and no other part of the app. The path carries the global 'v1'
 *          prefix: a browser matches Path against the whole URL path, so a
 *          path without it would be sent nowhere at all. The access cookie is
 *          Path=/ and SameSite=Lax, because it must survive a normal top-level
 *          navigation back into the app.
 *   R-3f — every name and lifetime comes from config, never from a literal here.
 *
 * The short-lived transfer cookies used during the handshake follow the same
 * rules: they carry the PKCE verifier and the state, which are as sensitive as
 * a token for the seconds they exist.
 */

export const SIGN_IN_VERIFIER_COOKIE = 'sv';
export const SIGN_IN_STATE_COOKIE = 'ss';
/** Long enough for a person to sign in, short enough not to linger. */
const HANDSHAKE_SECONDS = 600;

export function setSessionCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
  environment: AppEnvironment,
): void {
  const { cookies } = environment.auth;

  response.cookie(cookies.accessName, tokens.accessToken, {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: cookies.accessMaxAgeSeconds * 1000,
  });

  response.cookie(cookies.refreshName, tokens.refreshToken, {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'strict',
    path: cookies.refreshPath,
    maxAge: cookies.refreshMaxAgeSeconds * 1000,
  });
}

export function clearSessionCookies(response: Response, environment: AppEnvironment): void {
  const { cookies } = environment.auth;

  // The options must match those the cookie was set with, or the browser keeps it.
  response.clearCookie(cookies.accessName, {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'lax',
    path: '/',
  });
  response.clearCookie(cookies.refreshName, {
    httpOnly: true,
    secure: cookies.secure,
    sameSite: 'strict',
    path: cookies.refreshPath,
  });
}

export function setHandshakeCookies(
  response: Response,
  values: { codeVerifier: string; state: string },
  environment: AppEnvironment,
): void {
  const options = {
    httpOnly: true,
    secure: environment.auth.cookies.secure,
    // Lax, not Strict: the browser is arriving back from the identity provider,
    // which is a cross-site top-level navigation, and Strict would withhold them.
    sameSite: 'lax' as const,
    path: '/',
    maxAge: HANDSHAKE_SECONDS * 1000,
  };

  response.cookie(SIGN_IN_VERIFIER_COOKIE, values.codeVerifier, options);
  response.cookie(SIGN_IN_STATE_COOKIE, values.state, options);
}

export function clearHandshakeCookies(response: Response, environment: AppEnvironment): void {
  const options = {
    httpOnly: true,
    secure: environment.auth.cookies.secure,
    sameSite: 'lax' as const,
    path: '/',
  };

  response.clearCookie(SIGN_IN_VERIFIER_COOKIE, options);
  response.clearCookie(SIGN_IN_STATE_COOKIE, options);
}
