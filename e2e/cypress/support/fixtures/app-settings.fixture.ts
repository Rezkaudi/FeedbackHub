import { api } from '../clients/api.client';
import { ADMIN } from './accounts';
import type { AppSettings } from '../utils/types';

/**
 * The whole suite runs on one shared stack, so app settings are global
 * singleton state. Specs that need a non-default setting go through
 * `withAppSettings` rather than calling `api.settings.app.update` directly —
 * nothing currently enforces that mechanically (there is no ESLint config in
 * this package), so it is a convention to hold to in review, not a rule the
 * suite can catch on its own.
 *
 * `withAppSettings` snapshots the current settings, applies `changes` as
 * ADMIN, runs `body`, and restores the snapshot in an `after` that runs even
 * when `body` throws or a test inside it fails.
 *
 * IMPORTANT: give each distinct configuration its own top-level `describe`.
 * `before()`/`after()` are plain Mocha hooks scoped to whichever describe
 * calls them, and Mocha runs every `before()` in a describe before that
 * describe's FIRST test — regardless of where the call sits relative to the
 * `it()`s. A sibling `it()` outside the `withAppSettings` call, or a second
 * top-level `withAppSettings` call, both end up sharing the same before/after
 * pair as everything else in that describe, applying the configuration from
 * the very start and leaking it into tests that never asked for it. See
 * DECISIONS.md for the real failures this caused during the suite's build.
 */
export function withAppSettings(changes: Partial<AppSettings>, body: () => void): void {
  let snapshot: AppSettings | null = null;

  before(() => {
    cy.signIn(ADMIN);
    api.settings.app.read().then((current) => {
      snapshot = current;
      return api.settings.app.update(changes);
    });
  });

  after(() => {
    if (snapshot === null) {
      return;
    }
    cy.signIn(ADMIN);
    api.settings.app.update(snapshot);
  });

  body();
}

/** Suite-level variant with the same before/after pair, for a whole
 *  `describe` block rather than a wrapped callback — reads better when the
 *  settings apply to every test in the file. */
export function useAppSettings(changes: Partial<AppSettings>): void {
  let snapshot: AppSettings | null = null;

  before(() => {
    cy.signIn(ADMIN);
    api.settings.app.read().then((current) => {
      snapshot = current;
      return api.settings.app.update(changes);
    });
  });

  after(() => {
    if (snapshot === null) {
      return;
    }
    cy.signIn(ADMIN);
    api.settings.app.update(snapshot);
  });
}

/** Belt-and-braces leak detector: call from a spec's own `after` when it
 *  deliberately changed settings outside `withAppSettings` (should be never)
 *  to assert nothing was left dirty. Not required for specs using
 *  `withAppSettings`/`useAppSettings`, which already restore. */
export function assertSettingsMatch(expected: Partial<AppSettings>): void {
  api.settings.app.read().then((current) => {
    for (const [key, value] of Object.entries(expected)) {
      expect(current[key as keyof AppSettings], `settings.${key} leaked between tests`).to.deep.equal(value);
    }
  });
}
