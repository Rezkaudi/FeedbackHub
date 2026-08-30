import { expect, test } from '@playwright/test';
import { ADMIN, RAE } from '../support/accounts';
import { signIn } from '../support/sign-in';
import { post, readAppSettings, writeAppSettings } from '../support/api';

/**
 * R-130 to R-132: the limits, and the refusal that comes with a time.
 *
 * The rest of the suite runs with the submission limit lifted (see
 * `support/global-setup.ts`), because twenty tests quietly bumping into a limit
 * they are not about is how a suite becomes untrustworthy. This file is the
 * other side of that bargain: it sets the limit itself, files past it, and
 * watches the server refuse.
 *
 * The window is one minute rather than the seeded hour, and that is the whole
 * trick. The limit counts what this person has filed *inside the window*, so an
 * hour-long window would count every request left behind by every earlier run
 * and the test would pass or fail on history. One minute has no history in it.
 */

const A_MINUTE = 1;

async function submitOne(page: import('@playwright/test').Page, categoryId: string) {
  return post(page, '/requests', {
    title: `Rate limit probe ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    description: 'Filed by the end-to-end suite to see the limit work.',
    categoryId,
  });
}

test.describe('R-130 · the submission limit', () => {
  test('refuses the one past the limit, and says when they may try again', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await signIn(admin, ADMIN);
    const before = await readAppSettings(admin);

    // Rae, not Sam: Sam files requests all through `user-journeys.spec.ts`, and
    // borrowing that account would make this test depend on the order the files
    // happened to run in.
    const raeContext = await browser.newContext();
    const rae = await raeContext.newPage();
    await signIn(rae, RAE);

    const taxonomy = await (await rae.request.get('/v1/bootstrap')).json();
    const categoryId = (taxonomy as { categories: { id: string; isActive: boolean }[] }).categories
      .filter((category) => category.isActive)
      .map((category) => category.id)[0];
    expect(categoryId, 'no active category to file against').toBeDefined();

    try {
      await writeAppSettings(admin, {
        submissionLimitCount: 1,
        submissionLimitMinutes: A_MINUTE,
      });

      // The first one is inside the limit.
      const allowed = await submitOne(rae, categoryId!);
      expect(allowed.status(), await allowed.text()).toBe(201);

      // The second is not.
      const refused = await submitOne(rae, categoryId!);
      expect(refused.status()).toBe(429);

      const problem = (await refused.json()) as {
        error: { code: string; retryAt?: string; requestId: string };
      };
      expect(problem.error.code).toBe('SUBMISSION_RATE_LIMITED');

      // R-131: the refusal says when, and that time is one window after the
      // oldest attempt — so with a one-minute window it is within the next
      // minute, never an hour away.
      expect(problem.error.retryAt, 'the refusal did not say when to try again').toBeDefined();
      const retryAt = new Date(problem.error.retryAt!).getTime();
      expect(retryAt).toBeGreaterThan(Date.now() - 5_000);
      expect(retryAt).toBeLessThan(Date.now() + 2 * 60_000);
    } finally {
      await writeAppSettings(admin, {
        submissionLimitCount: before.submissionLimitCount,
        submissionLimitMinutes: before.submissionLimitMinutes,
      });
      await raeContext.close();
      await adminContext.close();
    }
  });

  /** R-132: a limit is not a permission. An admin is limited too. */
  test('limits an admin as well', async ({ page }) => {
    await signIn(page, ADMIN);
    const before = await readAppSettings(page);

    const taxonomy = (await (await page.request.get('/v1/bootstrap')).json()) as {
      categories: { id: string; isActive: boolean }[];
    };
    const categoryId = taxonomy.categories.filter((category) => category.isActive)[0]?.id;

    try {
      await writeAppSettings(page, {
        submissionLimitCount: 1,
        submissionLimitMinutes: A_MINUTE,
      });

      expect((await submitOne(page, categoryId!)).status()).toBe(201);
      expect((await submitOne(page, categoryId!)).status()).toBe(429);
    } finally {
      await writeAppSettings(page, {
        submissionLimitCount: before.submissionLimitCount,
        submissionLimitMinutes: before.submissionLimitMinutes,
      });
    }
  });
});
