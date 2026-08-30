import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SAM } from '../support/accounts';
import { signIn } from '../support/sign-in';

/**
 * R-163: an automated axe pass on the board, the request page and the settings
 * screen.
 *
 * The rule itself says what this is worth: "automated checks are a floor, not a
 * pass mark (R-108)." axe finds perhaps a third of what is wrong, and none of
 * what makes a screen actually usable — whether the focus goes somewhere sane
 * after a navigation, whether the vote button says what it did, whether the
 * error message is next to the field it is about. Those are checked by name and
 * by role all through the other spec files, which is the part that costs
 * thought. This file is the floor, and it is here so the floor cannot quietly
 * fall away.
 *
 * The tags are the ones a WCAG 2.2 AA claim rests on. Best-practice rules are
 * deliberately left out: they are opinions, and failing a build on an opinion
 * teaches people to switch the check off.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function violations(page: Page): Promise<string> {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();

  // The message has to say what is wrong and where, or a red build in CI is a
  // puzzle rather than a bug report.
  return result.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
    )
    .join('\n');
}

test.describe('the automated accessibility floor (R-163)', () => {
  test('the board', async ({ page }) => {
    await signIn(page, SAM);
    await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible();

    expect(await violations(page)).toBe('');
  });

  /** The empty board is a different screen, and it is the one nobody looks at. */
  test('the board with nothing on it', async ({ page }) => {
    await signIn(page, SAM);
    await page.goto('/?search=zzzznothingmatchesthis');
    await expect(page.getByText(/no requests|nothing/i).first()).toBeVisible();

    expect(await violations(page)).toBe('');
  });

  test('the request page, with its thread', async ({ page }) => {
    await signIn(page, SAM);
    await page.getByRole('link', { name: /dark mode for the whole board/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /dark mode/i })).toBeVisible();

    expect(await violations(page)).toBe('');
  });

  test('the settings screen', async ({ page }) => {
    await signIn(page, SAM);
    await page.goto('/settings');
    await expect(page.getByLabel('Display name')).toBeVisible();

    expect(await violations(page)).toBe('');
  });

  /**
   * Not in R-163, but the screen with the most controls per square inch is the
   * one most likely to grow a problem, and it costs one more sign-in to check.
   */
  test('the admin screens', async ({ page }) => {
    await signIn(page, ADMIN);

    await page.goto('/admin/taxonomy');
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
    expect(await violations(page)).toBe('');

    await page.goto('/admin/settings');
    await expect(page.getByLabel('Sign-up rule')).toBeVisible();
    expect(await violations(page)).toBe('');
  });

  /**
   * Dark mode is a second set of colours, so it is a second contrast problem.
   * Checking only the light theme would leave half the app unchecked (D-06 puts
   * the theme on the device, which is why this is a stored preference and not a
   * query parameter).
   */
  test('the board in dark mode', async ({ page }) => {
    await signIn(page, SAM);
    await page.goto('/settings');
    await page.getByLabel('Theme').selectOption('dark');
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    expect(await violations(page)).toBe('');

    await page.goto('/settings');
    await page.getByLabel('Theme').selectOption('system');
  });
});
