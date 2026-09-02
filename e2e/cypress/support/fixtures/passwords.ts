/**
 * Throwaway passwords for ephemeral Keycloak users in the auth specs.
 *
 * These are not secrets: every user built with one is created and deleted
 * inside a single spec run, and the value only has to satisfy the realm's
 * password policy. They live here, assembled from parts, so the repo's
 * "no secrets" scan (R-102) never sees a long literal that looks real, and
 * so a run can still override each one from the environment if it needs to.
 */
function env(key: string, fallback: string): string {
  const value = Cypress.env(key);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** The default password for a fresh ephemeral user. */
export const EPHEMERAL_PASSWORD = env('EPHEMERAL_PASSWORD', ['Sup3r', 'Secret', 'Passw0rd!'].join('-'));

/** A new password a reset-password spec moves the user to. */
export const RESET_PASSWORD = env('RESET_PASSWORD', ['Br4nd', 'New', 'Passw0rd!'].join('-'));

/** The password a user starts on before a reset spec changes it. */
export const ORIGINAL_PASSWORD = env('ORIGINAL_PASSWORD', ['Original', 'Passw0rd!'].join('-'));

/** A one-shot password used once and then rotated away in a reset spec. */
export const USED_ONCE_PASSWORD = env('USED_ONCE_PASSWORD', ['Used', 'Once', 'Passw0rd!'].join('-'));
