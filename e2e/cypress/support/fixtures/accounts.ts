export interface Account {
  readonly username: string;
  readonly password: string;
  readonly displayName: string;
  readonly isAdmin: boolean;
}

function env(key: string, fallback: string): string {
  const value = Cypress.env(key);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** Ada Admin — the original seeded admin. Never deleted, renamed or re-roled
 *  by any spec; other specs assume her display name and admin status. */
export const ADMIN: Account = {
  username: env('ADMIN_USERNAME', 'admin@feedbackhub.local'),
  password: env('ADMIN_PASSWORD', 'password'),
  displayName: 'Ada Admin',
  isAdmin: true,
};

/** Bo Boss — a second seeded admin, added so admin-vs-admin cases (one admin
 *  undoing another's change) and the last-admin invariant are provable without
 *  ever touching Ada. See DECISIONS.md for why a second admin was seeded. */
export const ADMIN2: Account = {
  username: env('ADMIN2_USERNAME', 'bo@feedbackhub.local'),
  password: env('ADMIN2_PASSWORD', 'password'),
  displayName: 'Bo Boss',
  isAdmin: true,
};

export const SAM: Account = {
  username: env('SAM_USERNAME', 'sam@feedbackhub.local'),
  password: env('SAM_PASSWORD', 'password'),
  displayName: 'Sam Sample',
  isAdmin: false,
};

export const RAE: Account = {
  username: env('RAE_USERNAME', 'rae@feedbackhub.local'),
  password: env('RAE_PASSWORD', 'password'),
  displayName: 'Rae Reader',
  isAdmin: false,
};

export const SEEDED_ACCOUNTS: readonly Account[] = [ADMIN, ADMIN2, SAM, RAE];
