import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Client, Issuer, generators } from 'openid-client';
import {
  IdentityProvider,
  SessionTokens,
  TokenClaims,
} from '../../application/port/user-repository';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from '../../../../shared/config/environment.token';
import { UnauthorizedError } from '../../../../shared/errors/app-error';

/**
 * Everything we do with Keycloak, in one place (R-1: we never write an auth
 * primitive — no password is hashed here, no reset flow, no social dance).
 *
 * R-3a — the handshake happens on our server. The browser only follows
 *        redirects; it never sees a code exchange.
 * R-3b — code + PKCE, with a confidential client whose secret comes from the
 *        environment and never reaches the front-end build.
 * R-5  — every token is checked: signature, issuer, audience, expiry. The
 *        library verifies against the provider's published keys, which are
 *        fetched once and refreshed by it as they rotate.
 *
 * A note on why the claims come from the *access* token rather than the id
 * token: the access token is the one that accompanies every later call, so it is
 * the one whose validity has to be established anyway.
 */
@Injectable()
export class KeycloakIdentityProvider implements IdentityProvider, OnModuleInit {
  private client?: Client;

  public constructor(
    @Inject(APP_ENVIRONMENT) private readonly environment: AppEnvironmentToken,
  ) {}

  /**
   * Discovery is one network call, made at boot rather than on the first
   * sign-in, so a misconfigured issuer shows up immediately. It is not fatal:
   * the readiness probe (R-83) reports the provider separately, and an instance
   * that cannot reach Keycloak should fail readiness rather than crash-loop.
   */
  public async onModuleInit(): Promise<void> {
    try {
      await this.ensureClient();
    } catch {
      // Left unconnected on purpose. ensureClient() retries on first use.
    }
  }

  private async ensureClient(): Promise<Client> {
    if (this.client !== undefined) {
      return this.client;
    }

    const issuer = await Issuer.discover(this.environment.oidc.issuerUrl);

    this.client = new issuer.Client({
      client_id: this.environment.oidc.clientId,
      client_secret: this.environment.oidc.clientSecret,
      redirect_uris: [this.environment.oidc.redirectUri],
      response_types: ['code'],
      // A confidential client (R-3b): the secret is sent from our server only.
      token_endpoint_auth_method: 'client_secret_basic',
    });

    return this.client;
  }

  /**
   * The address comes from the discovery document, never from string-joining
   * the issuer we happen to dial.
   *
   * Found by running the stack: the server reaches Keycloak at an internal
   * container name, and a URL built from that name is one the browser cannot
   * resolve — sign-in died at the redirect with nothing in any log, because
   * from the server's side everything had worked. Keycloak publishes a
   * browser-facing `authorization_endpoint` and a server-facing token endpoint
   * in the same document, so asking it is the only way to get both right.
   */
  public async startSignIn(): Promise<{ url: string; codeVerifier: string; state: string }> {
    const codeVerifier = generators.codeVerifier();
    const state = generators.state();
    const client = await this.ensureClient();

    const url = client.authorizationUrl({
      scope: 'openid profile email',
      state,
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });

    return { url, codeVerifier, state };
  }

  public async completeSignIn(input: {
    code: string;
    codeVerifier: string;
    expectedState: string;
    receivedState: string;
    receivedIssuer?: string;
  }): Promise<SessionTokens> {
    // Checked here rather than trusted: the state is what ties this callback to
    // the browser that started the sign-in.
    if (input.expectedState !== input.receivedState) {
      throw new UnauthorizedError('The sign-in could not be completed. Please try again.');
    }

    const client = await this.ensureClient();

    // RFC 9207. Keycloak advertises `authorization_response_iss_parameter_supported`
    // and puts `iss` on the callback, and openid-client then refuses any set of
    // parameters that lacks it. It is passed through exactly as it arrived, so
    // the library can compare it with the issuer it discovered; deciding here
    // whether it looks right would be doing the check twice, and worse.
    const tokens = await client.callback(
      this.environment.oidc.redirectUri,
      {
        code: input.code,
        state: input.receivedState,
        ...(input.receivedIssuer === undefined ? {} : { iss: input.receivedIssuer }),
      },
      { code_verifier: input.codeVerifier, state: input.expectedState },
    );

    if (tokens.access_token === undefined || tokens.refresh_token === undefined) {
      throw new UnauthorizedError('The sign-in could not be completed. Please try again.');
    }

    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
  }

  /** R-5. Never trusts a token it did not check. */
  public async verifyAccessToken(accessToken: string): Promise<TokenClaims> {
    const client = await this.ensureClient();

    // introspect() asks the provider itself, which also catches a token revoked
    // before its five minutes are up — the closest thing we have to ending a
    // session early (R-9a).
    const claims = await client.introspect(accessToken, 'access_token');

    if (claims.active !== true) {
      throw new UnauthorizedError();
    }

    const subject = typeof claims.sub === 'string' ? claims.sub : undefined;
    const email = typeof claims.email === 'string' ? claims.email : undefined;

    if (subject === undefined || email === undefined) {
      throw new UnauthorizedError();
    }

    const name = typeof claims.name === 'string' ? claims.name : undefined;
    const preferred =
      typeof claims.preferred_username === 'string' ? claims.preferred_username : undefined;

    return {
      subject,
      email,
      emailVerified: claims.email_verified === true,
      displayName: name ?? preferred ?? email.split('@')[0] ?? 'Someone',
      avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
    };
  }

  /** R-9a: the provider rotates the refresh token on every use. */
  public async refresh(refreshToken: string): Promise<SessionTokens> {
    const client = await this.ensureClient();
    const tokens = await client.refresh(refreshToken);

    if (tokens.access_token === undefined || tokens.refresh_token === undefined) {
      throw new UnauthorizedError();
    }

    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
  }

  /**
   * R-9: signing out ends the session at the identity provider too. We keep no
   * session list of our own (R-9a), so this is the only way to cut one short.
   */
  public async endSession(refreshToken: string): Promise<void> {
    const client = await this.ensureClient();

    try {
      await client.revoke(refreshToken, 'refresh_token');
    } catch {
      // The person is signing out. A provider that will not answer must not
      // stop us clearing their cookies, which is the part that matters here.
    }
  }
}
