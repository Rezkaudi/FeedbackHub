import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedGuard } from './authenticated.guard';
import { AdminGuard } from './admin.guard';
import { OriginGuard } from './origin.guard';
import { AuthenticatedUser, CurrentUserSource } from '../auth/authenticated-user';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error';

/**
 * The guard chain of R-138, in its fixed order:
 *   signed in -> Origin check -> schema check -> permission on the saved row
 *   -> rate limit -> the use case.
 *
 * The two guards here cover the first two links. R-6 is the rule they must never
 * break: not signed in is 401, signed in but not allowed is 403, and these are
 * never mixed up.
 */

const aUser = (role: 'user' | 'admin'): AuthenticatedUser => ({
  id: 'user-1',
  role,
  email: 'person@example.com',
  displayName: 'A Person',
});

// Nest always hands a guard a real handler and class; the Reflector reads
// metadata off them. The doubles below are stand-ins for exactly that.
class SomeController {}
const someHandler = function handler(): void {};

const contextFor = (request: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => someHandler,
    getClass: () => SomeController,
  }) as unknown as ExecutionContext;

describe('AuthenticatedGuard', () => {
  const sourceReturning = (user: AuthenticatedUser | null): CurrentUserSource => ({
    resolve: () => Promise.resolve(user),
  });

  const reflector = new Reflector();

  it('lets a signed-in person through and puts them on the request', async () => {
    const request: Record<string, unknown> = {};
    const guard = new AuthenticatedGuard(sourceReturning(aUser('user')), reflector);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual(aUser('user'));
  });

  it('answers 401 when there is no session — never 403 (R-6)', async () => {
    const guard = new AuthenticatedGuard(sourceReturning(null), reflector);

    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('leaves a route marked public alone, for the health checks and sign-in (R-6)', async () => {
    const guard = new AuthenticatedGuard(sourceReturning(null), reflector);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
  });
});

describe('AdminGuard', () => {
  const reflector = new Reflector();
  const guard = new AdminGuard(reflector);

  const withRoleRequired = (required: boolean): void => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required ? 'admin' : undefined);
  };

  it('lets an admin through', () => {
    withRoleRequired(true);

    expect(guard.canActivate(contextFor({ user: aUser('admin') }))).toBe(true);
  });

  it('answers 403 for a normal person, whatever the screen showed (R-70)', () => {
    withRoleRequired(true);

    expect(() => guard.canActivate(contextFor({ user: aUser('user') }))).toThrow(ForbiddenError);
  });

  it('answers 401, not 403, when nobody is signed in at all (R-6)', () => {
    withRoleRequired(true);

    expect(() => guard.canActivate(contextFor({}))).toThrow(UnauthorizedError);
  });

  it('does nothing on a route that needs no particular role', () => {
    withRoleRequired(false);

    expect(guard.canActivate(contextFor({ user: aUser('user') }))).toBe(true);
  });
});

describe('OriginGuard (R-3g)', () => {
  const allowed = ['https://feedbackhub.test'];
  const guard = new OriginGuard(allowed);

  const write = (headers: Record<string, string>): ExecutionContext =>
    contextFor({ method: 'POST', headers });

  it('allows a write from an origin on the list', () => {
    expect(guard.canActivate(write({ origin: 'https://feedbackhub.test' }))).toBe(true);
  });

  it('refuses a write from an origin that is not on the list', () => {
    expect(() => guard.canActivate(write({ origin: 'https://evil.test' }))).toThrow(ForbiddenError);
  });

  it('refuses a write that names no origin at all', () => {
    expect(() => guard.canActivate(write({}))).toThrow(ForbiddenError);
  });

  it('leaves reads alone, because a request that changes data is never a GET', () => {
    const read = contextFor({ method: 'GET', headers: { origin: 'https://evil.test' } });

    expect(guard.canActivate(read)).toBe(true);
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('checks %s', (method) => {
    const context = contextFor({ method, headers: { origin: 'https://evil.test' } });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it('never treats an empty allowlist as "allow everything"', () => {
    const strict = new OriginGuard([]);

    expect(() => strict.canActivate(write({ origin: 'https://feedbackhub.test' }))).toThrow(
      ForbiddenError,
    );
  });
});
