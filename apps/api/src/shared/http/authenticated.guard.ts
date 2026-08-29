import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CURRENT_USER_SOURCE, CurrentUserSource } from '../auth/authenticated-user';
import { UnauthorizedError } from '../errors/app-error';
import { IS_PUBLIC } from './route-metadata';

/**
 * Link one of the chain (R-138): is there a signed-in person?
 *
 * No session is 401 and only ever 401 (R-6). Whether that person is *allowed* to
 * do the thing is a different question, asked later, against the saved row.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  public constructor(
    @Inject(CURRENT_USER_SOURCE) private readonly users: CurrentUserSource,
    private readonly reflector: Reflector,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const user = await this.users.resolve(request);

    if (user === null) {
      throw new UnauthorizedError();
    }

    request.user = user;
    return true;
  }
}
