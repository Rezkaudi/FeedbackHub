import { expect, test } from '@playwright/test';
import { SAM } from '../support/accounts';
import { signIn } from '../support/sign-in';

/**
 * R-9: signing out clears the app's session and ends the one at the identity
 * provider too.
 *
 * This file exists because sign-out was broken in the shipped app and nothing
 * anywhere would have caught it. The button navigated the browser to
 * `/v1/auth/sign-out`, which is a GET; the route is a POST. So the person was
 * shown a raw JSON 404 — and, worse, their cookies were never cleared, so they
 * were still signed in while looking at a page that said "Not found".
 *
 * Every assertion below is about that: what the person sees, and what the
 * browser is still holding afterwards.
 */
test.describe('signing out (R-9)', () => {
  test('ends the session and returns to the sign-in flow, never to raw JSON', async ({ page }) => {
    await signIn(page, SAM);

    await page.getByRole('button', { name: /sign out/i }).click();

    // The person must never be left looking at the API's error shape. This is
    // the exact page the bug produced, so it is asserted by its own words.
    await expect(page.locator('body')).not.toContainText('NOT_FOUND');
    await expect(page.locator('body')).not.toContainText('requestId');

    // Signed out means signed out: the guard has nothing to work with, so the
    // browser ends up back at the identity provider.
    await page.waitForURL(/\/realms\/feedbackhub\/protocol\/openid-connect\/auth/, {
      timeout: 20_000,
    });
  });

  test('leaves neither cookie behind', async ({ page }) => {
    await signIn(page, SAM);

    const before = await page.context().cookies();
    expect(before.map((cookie) => cookie.name)).toEqual(expect.arrayContaining(['at', 'rt']));

    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/realms\/feedbackhub\/protocol\/openid-connect\/auth/, {
      timeout: 20_000,
    });

    // R-9: both are gone. The refresh cookie is the one that matters most — it
    // is scoped to /v1/auth (R-3e, D-32), so a sign-out that forgot to clear it
    // would leave the session renewable for as long as the provider allowed.
    const after = await page.context().cookies();
    const ours = after.filter((cookie) => cookie.domain.includes('localhost'));

    expect(ours.find((cookie) => cookie.name === 'at')).toBeUndefined();
    expect(ours.find((cookie) => cookie.name === 'rt')).toBeUndefined();
  });

  /**
   * R-9's second half, and the one that was really broken: "ends the session at
   * the identity provider too."
   *
   * Clearing our own cookies is easy and looks like success — the board goes
   * away, the guard redirects. But if the provider's session survives, that
   * redirect is answered silently with a fresh code and the person lands back
   * on the board, signed in, having pressed Sign out. That is what happened,
   * and only asking for the password screen catches it: every other assertion
   * in this file passed while it was broken.
   */
  test('really ends the session, so signing in asks for the password again', async ({ page }) => {
    await signIn(page, SAM);

    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/realms\/feedbackhub\/protocol\/openid-connect\/auth/, {
      timeout: 20_000,
    });

    // The provider is asking who this is, rather than remembering.
    await expect(page.getByLabel(/username|email/i)).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

    // And it is a real sign-in from here: the same helper that works from a
    // cold start works now, which it would not if a session were lingering.
    await page.getByLabel(/username|email/i).fill(SAM.username);
    await page.getByLabel('Password', { exact: true }).fill(SAM.password);
    await page.getByRole('button', { name: /^sign in$|^log in$/i }).click();

    await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible({ timeout: 20_000 });
  });

  test('the API refuses the session that was signed out', async ({ page }) => {
    await signIn(page, SAM);

    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/realms\/feedbackhub\/protocol\/openid-connect\/auth/, {
      timeout: 20_000,
    });

    // Not "the screen looks signed out" — the server has to say no as well.
    const response = await page.request.get('/v1/bootstrap');

    expect(response.status()).toBe(401);
  });
});
