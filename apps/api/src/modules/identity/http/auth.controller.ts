import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../shared/http/route-metadata';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from '../../../shared/config/environment.token';
import { IDENTITY_PROVIDER, IdentityProvider } from '../application/port/user-repository';
import { SignInWithProvider } from '../application/use-case/sign-in-with-provider';
import {
  SIGN_IN_STATE_COOKIE,
  SIGN_IN_VERIFIER_COOKIE,
  clearHandshakeCookies,
  clearSessionCookies,
  setHandshakeCookies,
  setSessionCookies,
} from './auth-cookies';
import { UnauthorizedError } from '../../../shared/errors/app-error';
import { SignupNotAllowed } from '../domain/error/identity-errors';
import { RateLimitedError } from '../../../shared/errors/app-error';
import { Logger } from '../../../shared/logging/logger';

/**
 * The sign-in handshake, entirely on our server (R-3a). The browser only follows
 * redirects and never sees a token (R-3c).
 *
 * These four routes are the only public ones besides the health checks (R-6).
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  public constructor(
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
    private readonly signInWithProvider: SignInWithProvider,
    @Inject(APP_ENVIRONMENT) private readonly environment: AppEnvironmentToken,
    private readonly logger: Logger,
  ) {}

  @Public()
  @Get('sign-in')
  @ApiOperation({ summary: 'Send the person to the identity provider (R-3a, R-3b).' })
  public async startSignIn(@Res() response: Response): Promise<void> {
    const { url, codeVerifier, state } = await this.provider.startSignIn();

    setHandshakeCookies(response, { codeVerifier, state }, this.environment);
    response.redirect(url);
  }

  /**
   * The provider sends the person back here with a code. We swap it for tokens
   * on the server, make or refresh the local record (R-4), and set the cookies.
   *
   * Everything that can go wrong ends as a redirect to a page that can explain
   * it, not as a JSON error: the person is in a browser following a redirect,
   * and SRS 15.8 asks for a clear page rather than a blank screen or a loop.
   */
  @Public()
  @Get('callback')
  @ApiExcludeEndpoint()
  public async completeSignIn(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('iss') iss: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, string | undefined>;
    const codeVerifier = cookies[SIGN_IN_VERIFIER_COOKIE];
    const expectedState = cookies[SIGN_IN_STATE_COOKIE];

    clearHandshakeCookies(response, this.environment);

    if (code === undefined || state === undefined || codeVerifier === undefined || expectedState === undefined) {
      return this.sendToProblemPage(response, 'sign_in_failed');
    }

    try {
      const tokens = await this.provider.completeSignIn({
        code,
        codeVerifier,
        expectedState,
        receivedState: state,
        // Passed on rather than checked here: RFC 9207 says the provider sends
        // it, and the library that discovered the issuer is what verifies it.
        receivedIssuer: iss,
      });

      // R-4: only now is a local record made, and only if the rule and the
      // limit both allow it.
      await this.signInWithProvider.execute(tokens.accessToken);

      setSessionCookies(response, tokens, this.environment);
      response.redirect(this.environment.appBaseUrl);
    } catch (error) {
      // The three outcomes SRS 15.8 asks to be told apart.
      if (error instanceof SignupNotAllowed) {
        return this.sendToProblemPage(response, `cannot_join&reason=${error.reason}`);
      }
      if (error instanceof RateLimitedError) {
        // They are allowed; they were unlucky with the timing. The page must
        // say to try later, not that they are not allowed.
        return this.sendToProblemPage(response, 'cannot_join_yet');
      }

      this.logger.warn({ err: error }, 'Sign-in could not be completed');
      return this.sendToProblemPage(response, 'sign_in_failed');
    }
  }

  /**
   * R-9a: the access token lives five minutes and the provider rotates the
   * refresh token on every use. The refresh cookie is scoped to the auth path
   * (R-3e), so it reaches here and sign-out, and nowhere else in the app.
   */
  @Public()
  @Post('refresh')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quietly renew the session (R-9a).' })
  public async refresh(@Req() request: Request, @Res() response: Response): Promise<void> {
    const cookies = request.cookies as Record<string, string | undefined>;
    const refreshToken = cookies[this.environment.auth.cookies.refreshName];

    if (refreshToken === undefined) {
      clearSessionCookies(response, this.environment);
      throw new UnauthorizedError();
    }

    try {
      const tokens = await this.provider.refresh(refreshToken);
      setSessionCookies(response, tokens, this.environment);
      response.status(204).send();
    } catch {
      // A refresh token that no longer works means the session is over. Clear
      // the cookies so the browser stops retrying with them.
      clearSessionCookies(response, this.environment);
      throw new UnauthorizedError();
    }
  }

  /** R-9: clears the app and ends the session at the identity provider too. */
  @Public()
  @Post('sign-out')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out here and at the identity provider (R-9).' })
  public async signOut(@Req() request: Request, @Res() response: Response): Promise<void> {
    const cookies = request.cookies as Record<string, string | undefined>;
    const refreshToken = cookies[this.environment.auth.cookies.refreshName];

    if (refreshToken !== undefined) {
      await this.provider.endSession(refreshToken);
    }

    clearSessionCookies(response, this.environment);
    response.status(204).send();
  }

  private sendToProblemPage(response: Response, problem: string): void {
    response.redirect(`${this.environment.appBaseUrl}/sign-in-problem?problem=${problem}`);
  }
}
