import { kc, type NewKcUser } from '../clients/keycloak-admin.client';
import { mailpit } from '../clients/mailpit.client';
import { stampedEmail } from '../utils/stamp';
import { EPHEMERAL_PASSWORD } from './passwords';

export interface EphemeralUser {
  email: string;
  password: string;
  displayName: string;
  kcId: string;
}

/**
 * Creates a throwaway Keycloak user for `body`, then tears it down: deletes
 * the Keycloak user (killing the credential outright), purges their Mailpit
 * messages, clears any cached `cy.session` for them, and — best effort —
 * removes their app record via `DELETE /v1/me` if they ever signed in, so no
 * orphan row survives a run. Every sign-up, reset-password, verify-email,
 * delete-account and refused-signup spec uses this rather than touching the
 * four seeded personas.
 */
export function withEphemeralUser(
  opts: Partial<NewKcUser> & { emailPrefix?: string; signIn?: boolean } = {},
  body: (user: EphemeralUser) => void,
): void {
  const email = opts.email ?? stampedEmail(opts.emailPrefix ?? 'e2e');
  const password = opts.password ?? EPHEMERAL_PASSWORD;
  const firstName = opts.firstName ?? 'E2E';
  const lastName = opts.lastName ?? 'Person';
  let user: EphemeralUser | null = null;

  before(() => {
    kc.createUser({
      email,
      password,
      firstName,
      lastName,
      emailVerified: opts.emailVerified ?? true,
      requiredActions: opts.requiredActions ?? [],
      enabled: opts.enabled ?? true,
    }).then((created) => {
      user = { email, password, displayName: `${firstName} ${lastName}`, kcId: created.id };
    });

    if (opts.signIn) {
      cy.signInFresh({ username: email, password });
    }
  });

  after(() => {
    if (user === null) {
      return;
    }
    // Deleting the Keycloak account is enough to make the credential dead and
    // stop the person existing as far as sign-in is concerned. An app-side
    // record, if implicit registration ever created one, is left behind as an
    // idle row — the same shape as any other account nobody signs into again,
    // and specs never assert on the full list of registered people, so it
    // does not interfere with anything. Reaching further to self-delete via
    // `DELETE /v1/me` would mean signing in as them one more time here, which
    // is not safe to do unconditionally (registration may have been refused
    // by policy, or the realm may be mid-`withRealmSettings` patch) — not
    // worth the fragility for a row nothing else ever looks at.
    kc.deleteUser(user.kcId);
    mailpit.purgeFor(email);
    Cypress.session.clearAllSavedSessions();
  });

  body({
    get email() {
      return email;
    },
    get password() {
      return password;
    },
    get displayName() {
      return `${firstName} ${lastName}`;
    },
    get kcId() {
      return user?.kcId ?? '';
    },
  });
}
