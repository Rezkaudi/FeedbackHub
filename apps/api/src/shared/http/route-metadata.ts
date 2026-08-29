import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';

/**
 * The two markers the guard chain reads. Keeping them in one file means the
 * chain has exactly two ways to be told about a route, and no controller can
 * invent a third (R-150).
 */

export const IS_PUBLIC = Symbol('IS_PUBLIC');
export const REQUIRED_ROLE = Symbol('REQUIRED_ROLE');

/**
 * R-6: every part of the app needs a signed-in person, except the health checks
 * and the sign-in handshake. Being public is opt-in and visible at the route.
 */
export const Public = (): CustomDecorator<symbol> => SetMetadata(IS_PUBLIC, true);

/**
 * R-8, R-70: an admin-only route. The guard still re-reads the role from the
 * saved row — this only says which role the route needs.
 */
export const RequiresAdmin = (): CustomDecorator<symbol> =>
  SetMetadata(REQUIRED_ROLE, 'admin' satisfies AuthenticatedUser['role']);
