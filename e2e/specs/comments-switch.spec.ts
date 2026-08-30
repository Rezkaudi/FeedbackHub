import { expect, test } from '@playwright/test';
import { ADMIN, SAM } from '../support/accounts';
import { signIn } from '../support/sign-in';
import { post, readAppSettings, writeAppSettings } from '../support/api';

/**
 * H-5: the comments feature switch, both halves.
 *
 * R-42 asks for four things at once when the switch is off — the comment box
 * and the thread are gone, the counts are gone from the board, and **the server
 * refuses to save a comment**. The last one is the whole point. A switch that
 * only hides a button is not a feature switch: anybody with the endpoint can
 * still write, and the feature is not off, it is merely invisible.
 *
 * So the same test that checks the screen also posts a comment by hand, with
 * the very session the browser is holding, and expects to be refused.
 *
 * This is the loudest test in the suite for shared state: with the switch off,
 * every other comment test would fail. It is put back in a `finally`, and it is
 * put back even if an assertion throws.
 */

const SAMS_REQUEST = '00000000-0000-4000-8000-0000000f0003';

test.describe('H-5 · the comments switch', () => {
  test('off means gone from the screen and refused by the server', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await signIn(admin, ADMIN);
    const before = await readAppSettings(admin);

    const samContext = await browser.newContext();
    const sam = await samContext.newPage();
    await signIn(sam, SAM);

    try {
      // With it on, the box and the count are there — otherwise the "gone"
      // assertions below would pass on a page that never had them.
      await sam.goto(`/requests/${SAMS_REQUEST}`);
      await expect(sam.getByRole('textbox', { name: /add a comment/i })).toBeVisible();
      await sam.goto('/');
      await expect(sam.getByText(/\d+ comments/).first()).toBeVisible();

      await writeAppSettings(admin, { featureCommentsEnabled: false });

      // R-42, the screen. "People will see it change the next time they load
      // the app" — the switch is read from the one start-up call (H-4), so a
      // reload is the honest way to check it, not a promise of live updates.
      await sam.goto(`/requests/${SAMS_REQUEST}`);
      await expect(sam.getByRole('textbox', { name: /add a comment/i })).toBeHidden();
      await expect(sam.getByRole('heading', { name: 'Comments' })).toBeHidden();
      await expect(sam.getByRole('list', { name: 'Comments' })).toBeHidden();

      // R-42, the board: no counts either.
      await sam.goto('/');
      await expect(sam.getByText(/\d+ comments/)).toHaveCount(0);

      // R-42, the server. This is the half that makes it a feature switch.
      const refused = await post(sam, `/requests/${SAMS_REQUEST}/comments`, {
        body: 'Written straight to the endpoint while comments are off.',
      });

      // SRS part 17 names the answer exactly: 403, with a message that says
      // comments are switched off. Not a 404, not a silent no-op, not a 500 —
      // each of those would leave the person guessing what they did wrong.
      expect(refused.status(), 'the server did not refuse a comment while comments were off').toBe(
        403,
      );
      const problem = (await refused.json()) as {
        error: { code: string; message: string; requestId: string };
      };
      expect(problem.error.code).toBe('FEATURE_DISABLED');
      expect(problem.error.message).toMatch(/comments are switched off/i);
      // R-105: every refusal carries an id the person can quote.
      expect(problem.error.requestId).not.toBe('');
    } finally {
      await writeAppSettings(admin, {
        featureCommentsEnabled: before.featureCommentsEnabled,
      });
      await samContext.close();
      await adminContext.close();
    }
  });

  test('back on, the thread is exactly where it was', async ({ page }) => {
    await signIn(page, SAM);
    await page.goto(`/requests/${SAMS_REQUEST}`);

    // Nothing was deleted while the switch was off — R-42 hides the feature, it
    // does not throw the discussion away.
    await expect(page.getByRole('textbox', { name: /add a comment/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();
  });
});
