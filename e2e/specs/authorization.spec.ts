import { expect, test } from '@playwright/test';
import { RAE, SAM } from '../support/accounts';
import { signIn } from '../support/sign-in';
import { del, get, patch, post } from '../support/api';

/**
 * The half of authorisation a screenshot can never show.
 *
 * Every admin control in this app is hidden from an ordinary person, and every
 * one of those rules says the same thing in the same words: hiding the screen
 * is not the check (R-66, R-70). So this file does not look at screens at all.
 * It signs Sam in for real, takes the session the browser is holding, and calls
 * the endpoints by hand — which is exactly what somebody who wanted to get
 * around the hidden button would do.
 *
 * A 403 here is the pass. A 401 would mean the session was not sent and the
 * test proved nothing, so the assertions name 403 exactly rather than "not ok".
 */

/** Seeded, and owned by Rae — so it is never Sam's to change. */
const RAES_REQUEST = '00000000-0000-4000-8000-0000000f0002';

test.describe('what the server refuses an ordinary person (R-70)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SAM);
  });

  test('refuses to change a status', async ({ page }) => {
    const response = await patch(page, `/requests/${RAES_REQUEST}/status`, {
      statusId: '00000000-0000-0000-0000-000000000000',
    });

    // 403, not 404 or 400: the answer must be about who is asking, and it must
    // come before anything looks at the body.
    expect(response.status()).toBe(403);
  });

  test('refuses to pin a request', async ({ page }) => {
    const response = await patch(page, `/requests/${RAES_REQUEST}/pin`, { pinned: true });

    expect(response.status()).toBe(403);
  });

  test('refuses to change the application settings', async ({ page }) => {
    const response = await patch(page, '/settings/app', { featureCommentsEnabled: false });

    expect(response.status()).toBe(403);
  });

  test('refuses to add a category', async ({ page }) => {
    const response = await post(page, '/taxonomy/categories', {
      name: 'Snuck in',
      color: '#123456',
    });

    expect(response.status()).toBe(403);
  });

  test('refuses to add a status', async ({ page }) => {
    const response = await post(page, '/taxonomy/statuses', {
      name: 'Snuck in',
      color: '#123456',
    });

    expect(response.status()).toBe(403);
  });

  /** R-66: only an admin adds, sees or removes an invitation. All three. */
  test('refuses the invitations, to read as well as to write', async ({ page }) => {
    expect((await get(page, '/invitations')).status()).toBe(403);
    expect((await post(page, '/invitations', { email: 'nobody@example.com' })).status()).toBe(403);
  });

  /** R-41: the moderation queue is an admin's, and reading it is a leak too. */
  test('refuses the waiting comments queue', async ({ page }) => {
    expect((await get(page, '/admin/comments/pending')).status()).toBe(403);
  });
});

/**
 * R-13, R-93: ownership. The screen hides Edit on somebody else's request
 * (`user-journeys.spec.ts` checks that), and the server refuses it as well.
 */
test.describe('what the server refuses on somebody else’s request', () => {
  test('refuses an edit', async ({ page }) => {
    await signIn(page, SAM);

    const response = await patch(page, `/requests/${RAES_REQUEST}`, {
      description: 'Rewritten by somebody who does not own it.',
    });

    expect(response.status()).toBe(403);
  });

  test('refuses a delete', async ({ page }) => {
    await signIn(page, SAM);

    const response = await del(page, `/requests/${RAES_REQUEST}`);

    expect(response.status()).toBe(403);
  });

  /** R-37: and the other way round, the owner is still allowed. */
  test('but Rae may edit her own', async ({ page }) => {
    await signIn(page, RAE);

    const before = await get(page, `/requests/${RAES_REQUEST}`);
    const original = ((await before.json()) as { description: string }).description;

    const response = await patch(page, `/requests/${RAES_REQUEST}`, {
      description: `${original}`,
    });

    expect(response.status()).toBe(200);
  });
});

/**
 * R-3g: a write that does not name an origin we know is refused, whatever
 * cookies it carries. This is the CSRF defence, and it is the one rule in this
 * file that cannot be checked through a browser at all — a browser always sets
 * `Origin` honestly, so the request has to be built by hand.
 */
test.describe('the origin check (R-3g)', () => {
  test('refuses a write that names an origin we do not know', async ({ page }) => {
    await signIn(page, SAM);

    const response = await page.request.post('/v1/requests', {
      headers: { Origin: 'https://evil.example' },
      data: { title: 'From somewhere else', description: 'x', categoryId: 'x' },
    });

    expect(response.status()).toBe(403);
  });

  test('lets a read through without one', async ({ page }) => {
    await signIn(page, SAM);

    // Reads are safe: they change nothing, and refusing them would break every
    // ordinary link into the app.
    const response = await page.request.get('/v1/bootstrap', { headers: { Origin: '' } });

    expect(response.status()).toBe(200);
  });
});

/** R-2, R-3: no session at all is a 401, not a 403 and not a blank 200. */
test.describe('with no session at all', () => {
  test('refuses the start-up call', async ({ request }) => {
    const response = await request.get('/v1/bootstrap');

    expect(response.status()).toBe(401);
  });

  test('sends the browser to the identity provider instead of a screen', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/realms\/feedbackhub\/protocol\/openid-connect\/auth/);
  });
});
