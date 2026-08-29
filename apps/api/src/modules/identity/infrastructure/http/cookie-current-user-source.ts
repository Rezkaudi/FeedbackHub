import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser, CurrentUserSource } from '../../../../shared/auth/authenticated-user';
import { IDENTITY_PROVIDER, IdentityProvider } from '../../application/port/user-repository';
import { ResolveCurrentUser } from '../../application/use-case/resolve-current-user';
import {
  APP_ENVIRONMENT,
  type AppEnvironmentToken,
} from '../../../../shared/config/environment.token';

/**
 * The implementation of the guard chain's first link (R-138), and the place
 * where R-3c and R-5 meet.
 *
 * The access token is read from the cookie and **never** from a header (R-5).
 * That is not a style choice: accepting `Authorization` as well would hand back
 * the protection R-3g relies on, because a header can be set by script from any
 * page, where a cookie cannot be forged cross-site.
 *
 * Returning null means "no session", which the guard turns into 401. It never
 * means "not allowed" — that distinction is R-6 and is decided above here.
 */
@Injectable()
export class CookieCurrentUserSource implements CurrentUserSource {
  public constructor(
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
    private readonly resolveCurrentUser: ResolveCurrentUser,
    @Inject(APP_ENVIRONMENT) private readonly environment: AppEnvironmentToken,
  ) {}

  public async resolve(request: unknown): Promise<AuthenticatedUser | null> {
    const cookies = (request as { cookies?: Record<string, unknown> }).cookies;
    const token = cookies?.[this.environment.auth.cookies.accessName];

    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }

    try {
      const claims = await this.provider.verifyAccessToken(token);
      // R-7: the token says which row to read; everything else comes from it.
      return await this.resolveCurrentUser.execute(claims.subject);
    } catch {
      // An expired or bad token is simply no session. The browser is expected
      // to call /auth/refresh and try again (SRS 15.8).
      return null;
    }
  }
}
