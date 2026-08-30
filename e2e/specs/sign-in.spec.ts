import { expect, test } from '@playwright/test';
import { SAM } from '../support/accounts';
import { expectNoTokenInBrowserStorage, signIn } from '../support/sign-in';

/**
 * U-1: a person signs in and lands on the board.
 *
 * This is the journey every other one stands on, so it also checks the two
 * properties that make the sign-in acceptable rather than merely working:
 * no token reaches browser storage (R-3c), and the app makes exactly one
 * blocking call to draw itself (R-52, H-4).
 */
test.describe('signing in', () => {
  test('sends a stranger to Keycloak and brings them back to the board', async ({ page }) => {
    await signIn(page, SAM);

    await expect(page).toHaveURL(/localhost:4200\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  /** R-3c: the browser holds cookies it cannot read, and nothing else. */
  test('leaves no token anywhere a script can read it', async ({ page }) => {
    await signIn(page, SAM);

    await expectNoTokenInBrowserStorage(page);

    // Our two cookies by name, not by a pattern. Keycloak sets cookies of its
    // own on its own origin — AUTH_SESSION_ID among them, deliberately
    // SameSite=None because it is part of a cross-origin flow — and a pattern
    // like /auth|session/ sweeps those in and asserts our rules against
    // somebody else's cookie.
    const cookies = await page.context().cookies();
    const byName = new Map(cookies.filter((c) => c.domain.includes('localhost')).map((c) => [c.name, c]));

    const access = byName.get('at');
    const refresh = byName.get('rt');

    expect(access, 'the access cookie is missing').toBeDefined();
    expect(refresh, 'the refresh cookie is missing').toBeDefined();

    // R-3d: script can never read either of them.
    expect(access!.httpOnly).toBe(true);
    expect(refresh!.httpOnly).toBe(true);

    // R-3e, and the two are deliberately different. The access cookie is Lax
    // and Path=/ because it has to survive the top-level navigation back from
    // Keycloak. The refresh cookie is Strict and scoped to the auth path, so it
    // reaches refresh and sign-out and no other route in the app — asserting
    // Lax on it would have quietly locked in a weaker rule than the one built.
    expect(access!.sameSite).toBe('Lax');
    expect(access!.path).toBe('/');

    expect(refresh!.sameSite).toBe('Strict');
    expect(refresh!.path).toContain('/v1/auth');

    // R-3d: no Domain is set, so no sibling subdomain can read them.
    expect(access!.domain).toBe('localhost');
    expect(refresh!.domain).toBe('localhost');
  });

  /**
   * H-4: "one call to /bootstrap, not a chain of blocking requests." Counting
   * the calls is the only way to prove it — a screenshot of a working board
   * looks identical whether it took one request or six.
   */
  test('draws itself from exactly one bootstrap call (H-4)', async ({ page }) => {
    await signIn(page, SAM);

    const calls: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/v1/')) {
        calls.push(`${request.method()} ${url.pathname}`);
      }
    });

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const bootstrapCalls = calls.filter((call) => call.endsWith('/v1/bootstrap'));
    expect(bootstrapCalls, `saw: ${calls.join(', ')}`).toHaveLength(1);
  });
});
