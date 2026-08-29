import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap-app';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { PrismaClient } from '@prisma/client';
import { APP_ENVIRONMENT } from '../../src/shared/config/environment.token';
import { loadEnvironment, AppEnvironment } from '../../src/shared/config/environment';
import {
  AuthenticatedUser,
  CURRENT_USER_SOURCE,
  CurrentUserSource,
} from '../../src/shared/auth/authenticated-user';
import { startTestDatabase, TestDatabase } from './database';
import {
  IDENTITY_PROVIDER,
  IdentityProvider,
  SessionTokens,
  TokenClaims,
} from '../../src/modules/identity/application/port/user-repository';

/**
 * A real Nest app, on a real Postgres, behind the real guard chain (R-158).
 *
 * The one thing faked is the identity provider: signing in for real belongs to
 * the end-to-end suite, which does exactly that through Keycloak (R-160). What
 * is *not* faked is the authorization — the guards, the role check and every
 * refusal below are the production ones. Swapping who is signed in is how the
 * "wrong user / wrong role / someone else's resource" cases of R-157 are
 * written without a browser.
 */
export const TEST_ORIGIN = 'https://feedbackhub.test';

export interface TestApi {
  readonly app: INestApplication;
  readonly prisma: PrismaClient;
  readonly database: TestDatabase;
  readonly identityProvider: StubIdentityProvider;
  /** Who the next request is from. `null` means nobody is signed in. */
  signInAs(user: AuthenticatedUser | null): void;
  close(): Promise<void>;
}

class SwappableUserSource implements CurrentUserSource {
  public current: AuthenticatedUser | null = null;

  public resolve(): Promise<AuthenticatedUser | null> {
    return Promise.resolve(this.current);
  }
}

/**
 * A stand-in for Keycloak. Signing in for real belongs to the end-to-end suite,
 * which does exactly that (R-160); here it would only prove that Keycloak works.
 *
 * What this does *not* fake is anything of ours: the sign-up rule, the sign-up
 * limit, the local record and every authorization check below are production
 * code. This only supplies the claims a verified token would have carried.
 */
export class StubIdentityProvider implements IdentityProvider {
  public claims: TokenClaims = {
    subject: 'kc-new-person',
    email: 'new@example.com',
    emailVerified: true,
    displayName: 'New Person',
    avatarUrl: null,
  };

  public startSignIn(): Promise<{ url: string; codeVerifier: string; state: string }> {
    return Promise.resolve({
      url: 'https://identity.test/authorize',
      codeVerifier: 'verifier',
      state: 'state',
    });
  }

  public completeSignIn(): Promise<SessionTokens> {
    return Promise.resolve({ accessToken: 'access', refreshToken: 'refresh' });
  }

  public verifyAccessToken(): Promise<TokenClaims> {
    return Promise.resolve(this.claims);
  }

  public refresh(): Promise<SessionTokens> {
    return Promise.resolve({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  }

  public endSession(): Promise<void> {
    return Promise.resolve();
  }
}

function testEnvironment(databaseUrl: string, redisUrl: string): AppEnvironment {
  return loadEnvironment({
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    APP_BASE_URL: TEST_ORIGIN,
    AUTH_ALLOWED_ORIGINS: TEST_ORIGIN,
    OIDC_ISSUER_URL: 'http://localhost:8080/realms/feedbackhub',
    OIDC_CLIENT_ID: 'feedbackhub-api',
    OIDC_CLIENT_SECRET: 'test-only-not-a-real-secret',
    OIDC_REDIRECT_URI: `${TEST_ORIGIN}/auth/callback`,
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_FROM: 'FeedbackHub <no-reply@feedbackhub.test>',
    SMTP_TIMEOUT: '5',
  });
}

export async function startTestApi(): Promise<TestApi> {
  const database = await startTestDatabase();
  const environment = testEnvironment(database.url, database.redisUrl);
  const userSource = new SwappableUserSource();
  const identityProvider = new StubIdentityProvider();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    providers: [{ provide: CURRENT_USER_SOURCE, useValue: userSource }],
  })
    .overrideProvider(APP_ENVIRONMENT)
    .useValue(environment)
    .overrideProvider(PrismaService)
    .useValue(database.prisma)
    .overrideProvider(CURRENT_USER_SOURCE)
    .useValue(userSource)
    .overrideProvider(IDENTITY_PROVIDER)
    .useValue(identityProvider)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(json({ limit: environment.requestBodyLimit }));
  configureApp(app, environment);
  await app.init();

  return {
    app,
    prisma: database.prisma,
    database,
    identityProvider,
    signInAs(user): void {
      userSource.current = user;
    },
    async close(): Promise<void> {
      await app.close();
      await database.stop();
    },
  };
}

export const someUser: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  role: 'user',
  email: 'person@example.com',
  displayName: 'A Person',
};

export const someAdmin: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000002',
  role: 'admin',
  email: 'admin@example.com',
  displayName: 'An Admin',
};
