import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error';
import { REQUIRED_ROLE } from './route-metadata';

/**
 * R-70: admin screens are refused by the server if someone types the address by
 * hand. Hiding the screen is not the check.
 *
 * The role compared here was read from the saved row by the source behind
 * AuthenticatedGuard, not from anything the caller sent (R-7, R-8).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AuthenticatedUser['role'] | undefined>(
      REQUIRED_ROLE,
      [context.getHandler(), context.getClass()],
    );

    if (required === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // Nobody signed in is 401, not 403 — even on an admin route (R-6).
    if (user === undefined) {
      throw new UnauthorizedError();
    }

    if (user.role !== required) {
      throw new ForbiddenError();
    }

    return true;
  }
}
