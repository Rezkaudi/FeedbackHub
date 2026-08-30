/**
 * The three people the stack is seeded with.
 *
 * Their ids are pinned in two places on purpose — the Keycloak realm export and
 * the database seed — so that `users.external_id` lines up with the subject in
 * the token without anybody having to log in first. D-26 explains what that
 * coupling costs. The tests only need the sign-in details and the role.
 */
export interface Account {
  readonly username: string;
  readonly password: string;
  readonly displayName: string;
  readonly isAdmin: boolean;
}

export const ADMIN: Account = {
  username: 'admin@feedbackhub.local',
  password: 'password',
  displayName: 'Ada Admin',
  isAdmin: true,
};

export const SAM: Account = {
  username: 'sam@feedbackhub.local',
  password: 'password',
  displayName: 'Sam Sample',
  isAdmin: false,
};

/** A second ordinary person, for the cases that need somebody else's request. */
export const RAE: Account = {
  username: 'rae@feedbackhub.local',
  password: 'password',
  displayName: 'Rae Reader',
  isAdmin: false,
};
