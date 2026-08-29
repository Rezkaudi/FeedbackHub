/**
 * Who the server believes is calling.
 *
 * This is built from the *saved row*, never from anything the browser sent
 * (R-7). The token says who signed in; the database says what they are allowed
 * to be. `role` in particular is re-read here before every admin action (R-8),
 * so an old token cannot carry a role the person no longer has.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly role: 'user' | 'admin';
  readonly email: string;
  readonly displayName: string;
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin';
}

/**
 * The port the guard chain reads. `identity` implements it; the shared kernel
 * never imports a module (that is the seam of R-141), so the contract lives
 * here and the implementation is bound at the composition root.
 *
 * Returns null when there is no valid session. Distinguishing "no session" from
 * "session but not allowed" is the whole of R-6, and it happens above this port,
 * never inside it.
 */
export interface CurrentUserSource {
  resolve(request: unknown): Promise<AuthenticatedUser | null>;
}

export const CURRENT_USER_SOURCE = Symbol('CurrentUserSource');
