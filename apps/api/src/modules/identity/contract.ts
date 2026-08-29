/**
 * What the identity module promises other modules (R-141).
 *
 * R-99: another person's email is never sent to a screen. It appears here
 * because `notifications` needs an address to write to, and that is a
 * server-side use that never reaches a browser.
 */
export interface UserView {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly role: 'user' | 'admin';
  readonly email: string;
  readonly isActive: boolean;
}

export interface PersonDisplay {
  readonly displayName: string;
  readonly avatarUrl: string | null;
}
