import { expect, test, type Page } from '@playwright/test';
import { SAM } from '../support/accounts';
import { signIn } from '../support/sign-in';

/**
 * The user journeys from brief §3.4, U-2 to U-6. U-1 (signing in) is in
 * `sign-in.spec.ts`, because the other properties worth asserting about it —
 * where the token is not, and the single bootstrap call — belong with it.
 *
 * Everything is queried by role, label or visible text. Nothing here reaches
 * for a CSS class: a test that knows the markup passes when the screen is
 * unusable and fails when somebody renames a class.
 */

/**
 * The seeded requests, by address.
 *
 * Several tests below go straight to one of these rather than clicking it on
 * the board. That is not a shortcut around the journey — U-3 has its own test
 * that opens a request by clicking it — it is because every run of the suite
 * files new requests, so on a database that has been used a few times the
 * seeded ones are no longer on the first page. A test about voting that fails
 * because of pagination is a test that says nothing.
 */
const DARK_MODE = '00000000-0000-4000-8000-0000000f0001';
/** Seeded, and owned by Rae — so it is never Sam's to change. */
const RAES_REQUEST = '00000000-0000-4000-8000-0000000f0002';
const SPREADSHEET = '00000000-0000-4000-8000-0000000f0003';
const RETIRED_CATEGORY = '00000000-0000-4000-8000-0000000f0004';

/** Unique per run, so a created request can never collide with an earlier one. */
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/**
 * Find a request by title on the board and open it.
 *
 * The waits are the point. Typing in the search box is debounced, so the board
 * rewrites the address and redraws the list a moment after the last keystroke.
 * A click that lands in that moment hits a row that is about to be replaced,
 * and the router never navigates — the test then goes looking for an Edit link
 * on a board. Waiting for the address to carry the search, and for the row to
 * be there, is what makes the click land on the row that stays.
 */
async function findAndOpen(page: Page, title: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Search').fill(title);
  await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(title)}`));

  const row = page.getByRole('link', { name: title });
  await expect(row).toBeVisible();
  await row.click();

  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

/**
 * Open the edit form from the request page.
 *
 * The wait is not decoration. The request page draws itself in two steps — the
 * request, then the thread underneath it — and the second step moves everything
 * on the page. Clicking Edit between the two finds the link, starts the click,
 * and then has the element move out from under it; Playwright reports "element
 * is not stable" and eventually gives up. Waiting for the page to stop fetching
 * is what makes the click land.
 */
async function openTheEditForm(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  const edit = page.getByRole('link', { name: 'Edit', exact: true });
  await expect(edit).toBeVisible();
  await edit.click();
  await expect(page.getByLabel('Description')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signIn(page, SAM);
});

/**
 * U-2: "Lands on the request list: sorted, filterable by status and category,
 * searchable by text, paginated."
 */
test.describe('U-2 · the board', () => {
  test('lists the seeded requests', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible();
    await expect(page.getByRole('link', { name: /dark mode for the whole board/i })).toBeVisible();
  });

  /** R-22: the address is the source of truth, so a filter must change it. */
  test('filters by status, and the address carries the filter', async ({ page }) => {
    await page
      .getByRole('group', { name: 'Status' })
      .getByRole('checkbox', { name: 'Done' })
      .check();

    await expect(page).toHaveURL(/statusIds=/);
    await expect(
      page.getByRole('link', { name: /export the board to a spreadsheet/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /search does not find words/i }),
    ).toBeHidden();
  });

  test('filters by category', async ({ page }) => {
    await page
      .getByRole('group', { name: 'Category' })
      .getByRole('checkbox', { name: 'Bug' })
      .check();

    await expect(page).toHaveURL(/categoryIds=/);
    // The pinned Feature request is the one to look for: pinned means it is
    // first whenever it is on the board at all (R-23), so its absence is the
    // filter working and never a page-size accident.
    await expect(page.getByRole('link', { name: /dark mode for the whole board/i })).toBeHidden();
    await expect(page.getByText(/requests? found/)).toBeVisible();
  });

  test('searches titles and descriptions', async ({ page }) => {
    await page.getByLabel('Search').fill('spreadsheet');

    await expect(
      page.getByRole('link', { name: /export the board to a spreadsheet/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /dark mode/i })).toBeHidden();
  });

  test('sorts, and the address carries the sort', async ({ page }) => {
    await page.getByLabel('Sort').selectOption('most_votes');

    await expect(page).toHaveURL(/sort=most_votes/);
    await expect(page.getByText(/requests? found/)).toBeVisible();
  });

  /**
   * R-22 again, from the other side: the board is reconstructed from the
   * address alone. This is the property that makes a filtered board shareable.
   */
  test('rebuilds the same board from a pasted address', async ({ page }) => {
    await page.getByLabel('Search').fill('spreadsheet');
    await expect(page).toHaveURL(/search=spreadsheet/);

    const shared = page.url();
    await page.goto('/');
    await page.goto(shared);

    await expect(page.getByLabel('Search')).toHaveValue('spreadsheet');
    await expect(
      page.getByRole('link', { name: /export the board to a spreadsheet/i }),
    ).toBeVisible();
  });

  /** R-25: a filter that matches nothing says so, and the filters stay put. */
  test('says so when a search matches nothing, without losing the search', async ({ page }) => {
    await page.getByLabel('Search').fill('zzzznothingmatchesthis');

    await expect(page.getByText(/no requests|nothing/i).first()).toBeVisible();
    await expect(page.getByLabel('Search')).toHaveValue('zzzznothingmatchesthis');
  });
});

/**
 * U-3: "Opens a request, reads the discussion, upvotes it, adds a comment."
 */
test.describe('U-3 · reading and joining a discussion', () => {
  test('opens a request and reads it', async ({ page }) => {
    await page.getByRole('link', { name: /dark mode for the whole board/i }).click();

    await expect(
      page.getByRole('heading', { name: /dark mode for the whole board/i }),
    ).toBeVisible();
    await expect(page.getByText(/hard on the eyes/i)).toBeVisible();
  });

  /**
   * R-31: the vote button's accessible name carries the count and the state, so
   * the assertion is on the name changing — which is exactly what a screen
   * reader announces.
   */
  test('upvotes, and the button says so afterwards', async ({ page }) => {
    await page.goto(`/requests/${SPREADSHEET}`);

    // A vote is durable, so a previous run may already have left one here. Start
    // from a known state rather than assuming one — otherwise this test passes
    // or fails depending on what ran before it.
    //
    // The wait below is the whole point. `isVisible()` answers immediately and
    // does not wait, so asking it while the page was still drawing said "no
    // vote here" on a page that had no buttons at all yet — the vote was left
    // in place and the test failed on the line after. Waiting for the button in
    // *either* state first is what makes the question answerable.
    const voteButton = page.getByRole('button', { name: /vote for this request|you voted/i });
    await expect(voteButton).toBeVisible();

    const voted = page.getByRole('button', { name: /take your vote back/i });
    if (await voted.isVisible()) {
      await voted.click();
    }

    const before = page.getByRole('button', { name: /vote for this request/i });
    await expect(before).toBeVisible();
    const count = Number(((await before.getAttribute('aria-label')) ?? '').match(/^(\d+)/)?.[1] ?? '0');

    await before.click();

    // R-31: the name carries the new count and the new state.
    const after = page.getByRole('button', { name: /you voted/i });
    await expect(after).toHaveAttribute('aria-label', new RegExp(`^${count + 1} votes?\\.`));
    await expect(after).toHaveAttribute('aria-pressed', 'true');

    // Leave it as it was found, so the next run starts from the same place.
    await after.click();
    await expect(page.getByRole('button', { name: /vote for this request/i })).toBeVisible();
  });

  /** R-27: voting twice is not an error, it is taking the vote back. */
  test('takes the vote back', async ({ page }) => {
    await page.goto(`/requests/${RETIRED_CATEGORY}`);

    // Same reason as above: wait for the button in either state before asking
    // which state it is in.
    await expect(
      page.getByRole('button', { name: /vote for this request|you voted/i }),
    ).toBeVisible();
    const alreadyVoted = page.getByRole('button', { name: /take your vote back/i });
    if (await alreadyVoted.isVisible()) {
      await alreadyVoted.click();
    }

    await page.getByRole('button', { name: /vote for this request/i }).click();
    await expect(page.getByRole('button', { name: /you voted/i })).toBeVisible();

    await page.getByRole('button', { name: /take your vote back/i }).click();
    await expect(page.getByRole('button', { name: /vote for this request/i })).toBeVisible();
  });

  /** R-33d: the new comment appears at the top without reloading the page. */
  test('adds a comment and sees it appear', async ({ page }) => {
    const body = `A comment from the E2E suite ${stamp()}`;

    await page.goto(`/requests/${DARK_MODE}`);
    await page.getByRole('textbox', { name: /add a comment/i }).fill(body);
    await page.getByRole('button', { name: /add comment/i }).click();

    await expect(page.getByText(body)).toBeVisible();
    // Still the same page load — nothing navigated.
    await expect(page.getByRole('heading', { name: /dark mode/i })).toBeVisible();
  });
});

/**
 * U-4: "Submits a new request; sees it appear in the list."
 */
test.describe('U-4 · submitting a request', () => {
  test('creates a request and finds it on the board', async ({ page }) => {
    const title = `E2E submitted ${stamp()}`;

    await page.getByRole('link', { name: 'New request', exact: true }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Description').fill('Written by the end-to-end suite.');
    await page.getByLabel('Category').selectOption({ index: 1 });
    await page.getByRole('button', { name: /^save$/i }).click();

    await page.goto('/');
    await page.getByLabel('Search').fill(title);
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  });

  /** R-87, R-112: the message sits next to the field, and is not a toast. */
  test('refuses an empty title, in place', async ({ page }) => {
    await page.getByRole('link', { name: 'New request', exact: true }).click();
    await page.getByLabel('Title').fill('x');
    await page.getByLabel('Title').clear();
    await page.getByLabel('Description').click();

    // R-87: the message sits next to the field. The exact words come from the
    // form's own schema, so this fails loudly if somebody changes them.
    await expect(page.getByText('Give the request a title.')).toBeVisible();
  });
});

/**
 * U-5: "Finds their own earlier request, edits its description, and later
 * deletes it."
 */
test.describe('U-5 · changing my own request', () => {
  test('edits the description, then deletes the request', async ({ page }) => {
    const title = `E2E owned ${stamp()}`;

    // Something of Sam's own to work on, made through the UI like anything else.
    await page.getByRole('link', { name: 'New request', exact: true }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Description').fill('The first description.');
    await page.getByLabel('Category').selectOption({ index: 1 });
    await page.getByRole('button', { name: /^save$/i }).click();

    // Find it again the way a person would, rather than keeping its id.
    await findAndOpen(page, title);

    await openTheEditForm(page);
    await page.getByLabel('Description').fill('The description after editing.');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText('The description after editing.')).toBeVisible();

    // R-91: deleting asks first, and names what is being deleted.
    await openTheEditForm(page);
    await page.getByRole('button', { name: /delete request/i }).click();
    await expect(page.getByText(new RegExp(`delete.*${title}`, 'i'))).toBeVisible();
    await page.getByRole('button', { name: /delete it/i }).click();

    await page.goto('/');
    await page.getByLabel('Search').fill(title);
    await expect(page.getByRole('link', { name: title })).toBeHidden();
  });

  /**
   * R-70: the edit control is not offered on somebody else's request. The
   * server refuses as well, which `authorization.spec.ts` proves separately —
   * this only checks that the screen does not invite the attempt.
   */
  test('offers no edit on somebody else’s request', async ({ page }) => {
    // Straight to the address, not through the board. This test is about what
    // the request page offers, and every run of the suite adds requests of its
    // own — so on a database that has been used, Rae's seeded request is no
    // longer on the first page and clicking a link that is not there fails for
    // a reason that has nothing to do with the rule.
    await page.goto(`/requests/${RAES_REQUEST}`);
    await expect(
      page.getByRole('heading', { level: 1, name: /search does not find words/i }),
    ).toBeVisible();

    await expect(page.getByRole('link', { name: /^edit$/i })).toBeHidden();
  });
});

/**
 * U-6: "Updates their profile and application preferences."
 */
test.describe('U-6 · profile and preferences', () => {
  test('saves a new display name and says it saved', async ({ page }) => {
    const name = `Sam ${stamp()}`;

    await page.goto('/settings');
    const field = page.getByLabel('Display name');
    await expect(field).not.toHaveValue('');
    const before = await field.inputValue();

    try {
      await field.fill(name);
      await page.getByRole('button', { name: /save profile/i }).click();

      await expect(page.getByText(/^saved\.$/i).first()).toBeVisible();

      // It survives a reload, which is the part that proves it reached the
      // server.
      await page.reload();
      await expect(page.getByLabel('Display name')).toHaveValue(name);
    } finally {
      // Sam's name is on every request Sam wrote, so a stamped name left behind
      // spreads across the whole board and every later screenshot of it.
      await page.goto('/settings');
      await page.getByLabel('Display name').fill(before);
      await page.getByRole('button', { name: /save profile/i }).click();
      await expect(page.getByText(/^saved\.$/i).first()).toBeVisible();
    }
  });

  test('saves the email preferences', async ({ page }) => {
    await page.goto('/settings');

    const box = page.getByRole('checkbox', { name: /somebody comments on my request/i });
    const wasChecked = await box.isChecked();
    await box.setChecked(!wasChecked);
    await page.getByRole('button', { name: /save language and email/i }).click();

    await expect(page.getByText(/^saved\.$/i).first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('checkbox', { name: /somebody comments on my request/i }))
      .toBeChecked({ checked: !wasChecked });
  });

  /**
   * D-06: the theme is kept on the device, not the account. The settings screen
   * says so in as many words, and this checks the behaviour behind the words.
   */
  test('keeps the theme on this device', async ({ page }) => {
    await page.goto('/settings');
    await page.getByLabel('Theme').selectOption('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByLabel('Theme').selectOption('system');
  });
});
