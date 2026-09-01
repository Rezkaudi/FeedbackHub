import { User } from '../../domain/entity/user';
import { TransactionClient } from '../../../../shared/rate-limit/sliding-window';

export interface UserRepository {
  findByExternalId(externalId: string): Promise<User | null>;
  /**
   * Used only when a sign-in arrives with an unknown subject: a verified email
   * that already has a record means the provider gave the same person a new
   * subject, not that someone new is joining.
   */
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** One query for many authors, so a comment list is never N+1 (R-103). */
  findManyByIds(ids: readonly string[]): Promise<User[]>;
  save(user: User): Promise<User>;
  /** R-62: the app must never be left with nobody who can run it. */
  countActiveAdmins(): Promise<number>;

  /**
   * R-4 + R-130 + R-132, as one call: check the sign-up limit and insert the
   * new person **inside one database step**, so twenty-one people arriving in
   * the same second cannot all become the twentieth.
   *
   * The limit is passed in rather than read here, because it is an admin setting
   * owned by another module (R-141).
   */
  createWithinSignupLimit(
    user: User,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<User>;

  /**
   * R-61: wipe the person, drop their votes, keep their requests and comments.
   * One transaction, because a half-deleted account is worse than either state.
   */
  wipeAccount(user: User, at: Date): Promise<void>;
}

export interface TokenClaims {
  readonly subject: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
}

export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Everything we need from the identity provider, and nothing more. We never
 * write an auth primitive (R-1): no password is hashed here, no reset flow, no
 * social dance of our own — this port is the whole of our relationship with it.
 */
export interface IdentityProvider {
  /**
   * Step one of R-3a: where to send the person, with PKCE (R-3b).
   *
   * Asynchronous because the address must come from the provider's own
   * discovery document rather than be assembled from the issuer we dial: the
   * two are not always the same host. In a container stack the server reaches
   * Keycloak on an internal name the browser cannot resolve, so a URL built by
   * hand sends the person somewhere that does not exist.
   */
  startSignIn(): Promise<{ url: string; codeVerifier: string; state: string }>;

  /**
   * Step two: swap the code for tokens, on our server, never in the browser.
   *
   * `receivedIssuer` is the `iss` the provider puts on the callback (RFC 9207).
   * It must be handed over untouched: a provider that says it sends one is
   * checked against it, and a caller that drops it fails every sign-in.
   */
  completeSignIn(input: {
    code: string;
    codeVerifier: string;
    expectedState: string;
    receivedState: string;
    receivedIssuer?: string;
  }): Promise<SessionTokens>;

  /** R-5: check the signature, the issuer, the audience, and that it is not old. */
  verifyAccessToken(accessToken: string): Promise<TokenClaims>;

  /** R-9a: the provider rotates the refresh token on every use. */
  refresh(refreshToken: string): Promise<SessionTokens>;

  /** R-9: sign out ends the session at the provider too. */
  endSession(refreshToken: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
export const IDENTITY_PROVIDER = Symbol('IdentityProvider');

export type { TransactionClient };
