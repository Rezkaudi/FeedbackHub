import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { UnauthorizedError } from '../errors/app-error';

/**
 * Reads the person the guard chain already established. A controller never
 * takes an actor id from the body or the query string — that is exactly the
 * mistake R-7 forbids, and there is no way to make it with this decorator.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    if (request.user === undefined) {
      throw new UnauthorizedError();
    }

    return request.user;
  },
);
