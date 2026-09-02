import { kc } from '../clients/keycloak-admin.client';

/**
 * GETs the realm, PUTs `patch` over it, runs `body`, then PUTs the original
 * values for exactly the touched keys back — restoring in an `after` that
 * runs even on failure. Used for `accessTokenLifespan` (the real-expiry case
 * in `01-07-session-lifecycle.cy.ts`) and `verifyEmail` (the
 * `email_not_verified` refusal case in `01-04-sign-up-refused.cy.ts`). Only
 * two specs use this — it patches state every persona's token depends on, so
 * keep it out of anywhere the number of callers could quietly grow.
 *
 * Like `withAppSettings`, give each call its own top-level (or at least its
 * own nested) `describe` — its `before()` applies `patch` from the very
 * start of whichever describe it is called in, not just around the tests
 * that follow it textually.
 */
export function withRealmSettings(patch: Record<string, unknown>, body: () => void): void {
  let originals: Record<string, unknown> | null = null;

  before(() => {
    kc.readRealm().then((current) => {
      originals = Object.fromEntries(Object.keys(patch).map((key) => [key, current[key]]));
      return kc.patchRealm(patch);
    });
  });

  after(() => {
    if (originals === null) {
      return;
    }
    kc.patchRealm(originals);
  });

  body();
}
