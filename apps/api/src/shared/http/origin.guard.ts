import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ForbiddenError } from '../errors/app-error';

/**
 * R-3g: because the auth cookies go with every request, the server stops
 * cross-site writes two ways — SameSite on the cookie, and this Origin check on
 * every request that changes data.
 *
 * Reads are not checked: a request that changes data is never a GET (R-3g), so a
 * GET has nothing to protect here. An unknown or missing Origin on a write is
 * refused; an empty allowlist refuses everything, because an allowlist of
 * nothing must never quietly mean "allow everything".
 */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class OriginGuard implements CanActivate {
  public constructor(private readonly allowedOrigins: readonly string[]) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      headers?: Record<string, unknown>;
    }>();

    if (!WRITE_METHODS.has((request.method ?? 'GET').toUpperCase())) {
      return true;
    }

    const origin = request.headers?.origin;

    if (typeof origin !== 'string' || !this.allowedOrigins.includes(origin)) {
      throw new ForbiddenError('This request did not come from an allowed origin.');
    }

    return true;
  }
}
