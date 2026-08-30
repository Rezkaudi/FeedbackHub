import { expect, type Page } from '@playwright/test';
import type { Account } from './accounts';

/**
 * Sign in the way a person does: through the real Keycloak login page (R-160).
 *
 * There is no shortcut here on purpose. No token is minted, no cookie is
 * forged, no API call stands in for the browser. The whole point of this helper
 * is to prove the round trip works — the app sends the browser to
 * `/v1/auth/sign-in`, the API starts code + PKCE with a confidential client,
 * Keycloak authenticates the person, the API swaps the code for tokens on the
 * server and sets HttpOnly cookies (R-3c). A faked cookie would test nothing
 * and would still pass if the whole flow were broken.
 */
export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto('/');

  // Not signed in yet, so the guard sends the browser out to the identity
  // provider. Waiting on the URL rather than on a click keeps this honest about
  // where the redirect actually lands.
  await page.waitForURL(/\/realms\/feedbackhub\/protocol\/openid-connect\/auth/, {
    timeout: 20_000,
  });

  await page.getByLabel(/username|email/i).fill(account.username);
  // Exact, because Keycloak puts a "Show password" toggle next to the field and
  // a loose /password/i matches the button as well as the input.
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: /^sign in$|^log in$/i }).click();

  // Back on our own origin, with the board drawn. Waiting for the heading
  // rather than for the URL means the assertion covers the part that matters:
  // the session survived the redirect and `/bootstrap` answered.
  await page.waitForURL((url) => url.port === '4200' || url.pathname === '/', {
    timeout: 20_000,
  });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
}

/**
 * R-3c in one line: the browser must never hold a token where a script can read
 * it. Called from the sign-in journey rather than from every test, because it
 * is a property of the session, not of each page.
 */
export async function expectNoTokenInBrowserStorage(page: Page): Promise<void> {
  const leaked = await page.evaluate(() => {
    const suspicious = (value: string | null): boolean =>
      value !== null && /eyJ[A-Za-z0-9_-]{10,}\./.test(value);

    const found: string[] = [];
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key !== null && suspicious(store.getItem(key))) {
          found.push(key);
        }
      }
    }
    return found;
  });

  expect(leaked, 'a JWT was found in browser storage').toEqual([]);
}
