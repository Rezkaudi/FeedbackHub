import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SAM } from '../support/accounts';
import { signIn } from '../support/sign-in';
import { get, patch, readAppSettings, writeAppSettings } from '../support/api';

/**
 * The admin journeys from brief §6.2, A-1 to A-5.
 *
 * These change shared state — a status, a pin, a category, a switch — so every
 * test here puts back what it moved. Playwright runs this suite on one worker
 * (see `playwright.config.ts`), which makes "change it, check it, put it back"
 * safe; with two workers it would not be, and that is the reason for the one
 * worker rather than any speed measurement.
 */

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/** Sam's, seeded, and the one this file moves around. */
const SAMS_REQUEST = '00000000-0000-4000-8000-0000000f0003';

interface Status {
  id: string;
  name: string;
  isDefault: boolean;
}

async function statuses(page: Page): Promise<Status[]> {
  const response = await get(page, '/bootstrap');
  return ((await response.json()) as { statuses: Status[] }).statuses;
}

test.describe('A-1 · reviewing what has just come in', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN);
  });

  /**
   * R-63: "the board, newest first, filtered to the first status. One saved
   * link is enough." So the thing to prove is that no separate screen is
   * needed — an ordinary board address does the whole job, which is only true
   * because R-22 put the filters in the URL.
   */
  test('is an ordinary board address, not a screen of its own', async ({ page }) => {
    const first = (await statuses(page)).find((status) => status.isDefault);
    expect(first, 'no status is marked as the first one').toBeDefined();

    // `filtered=1` is the app's own flag, and it has to be here: without it the
    // board treats the address as having said nothing about filters and falls
    // back to whatever the person has saved (R-24). It is in every address the
    // app writes, so a link copied out of the browser bar carries it — this one
    // is written by hand, so it has to say so too.
    await page.goto(`/?filtered=1&sort=newest&statusIds=${first!.id}`);

    // The filters come back from the address, so the link really is savable.
    await expect(page.getByLabel('Sort')).toHaveValue('newest');
    await expect(
      page.getByRole('group', { name: 'Status' }).getByRole('checkbox', { name: first!.name }),
    ).toBeChecked();

    // And it shows what it says. The two requests to look for are both ones the
    // filter must *drop*: the pinned Planned one, which would otherwise be
    // first on the board whatever else is there (R-23), and the Done one. A
    // "this is still visible" assertion would be about page size instead —
    // every run of the suite files more requests in the first status, and the
    // seeded ones drift off page one.
    await expect(page.getByRole('link', { name: /dark mode for the whole board/i })).toBeHidden();
    await expect(
      page.getByRole('link', { name: /export the board to a spreadsheet/i }),
    ).toBeHidden();
    await expect(page.getByText(/requests? found/)).toBeVisible();
  });
});

test.describe('A-2 · changing a status and pinning', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN);
  });

  /** R-64: only an admin, and it shows at once. */
  test('changes the status from the request page, and it shows at once', async ({ page }) => {
    const all = await statuses(page);
    const before = all.find((status) => status.name === 'Done');
    const target = all.find((status) => status.name === 'In Progress');
    expect(before && target, 'the seeded statuses are missing').toBeTruthy();

    await page.goto(`/requests/${SAMS_REQUEST}`);

    try {
      await page.getByLabel('Status').selectOption(target!.id);

      // No reload: the chip beside the title is the same page, redrawn. The
      // chip is named by its element rather than by its text because every
      // status name is also sitting in the picker's own options — a plain text
      // match would go green whether the status changed or not.
      await expect(
        page.locator('fh-taxonomy-chip').filter({ hasText: target!.name }),
      ).toBeVisible();

      // And it really reached the server, not just the screen.
      await page.reload();
      await expect(page.getByLabel('Status')).toHaveValue(target!.id);
    } finally {
      // In a `finally`, because half the board suite reads this request's
      // status. Leaving it moved would fail four later tests with a message
      // about the wrong thing.
      await patch(page, `/requests/${SAMS_REQUEST}/status`, { statusId: before!.id });
    }
  });

  /** R-65, R-23: a pinned request goes to the top of the board. */
  test('pins a request, and it goes to the top', async ({ page }) => {
    await page.goto(`/requests/${SAMS_REQUEST}`);

    // Either state, first: a run that stopped half way through may have left it
    // pinned, and `isVisible()` on a page still drawing answers "no" to both.
    await expect(
      page.getByRole('button', { name: /pin to the top|unpin from the top/i }),
    ).toBeVisible();
    const alreadyPinned = page.getByRole('button', { name: /unpin from the top/i });
    if (await alreadyPinned.isVisible()) {
      await alreadyPinned.click();
    }

    try {
      const pin = page.getByRole('button', { name: /pin to the top/i });
      await expect(pin).toBeVisible();
      await pin.click();
      await expect(page.getByRole('button', { name: /unpin from the top/i })).toBeVisible();

      // R-23: pinned first, whatever the sort says. Oldest-first is the harsh
      // case, because this request is *newer* than one it now has to come
      // before. Comparing the two positions says that in one line, and it does
      // not care how many other requests are pinned or how many rows sit
      // between them.
      await page.goto('/?filtered=1&sort=oldest');
      // `allInnerTexts()` answers straight away and does not wait, so it has to
      // be asked after the list is on screen, not while it is still loading —
      // an empty array reads as "the pinned request is missing".
      await expect(page.getByRole('article').first()).toBeVisible();
      const titles = await page.getByRole('article').getByRole('heading').allInnerTexts();
      const pinned = titles.findIndex((title) => /export the board to a spreadsheet/i.test(title));
      const older = titles.findIndex((title) => /search does not find words/i.test(title));

      expect(
        pinned,
        `the pinned request is not on the first page: ${titles.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0);
      expect(older).toBeGreaterThanOrEqual(0);
      expect(pinned, 'a pinned request did not come before an older unpinned one').toBeLessThan(
        older,
      );
    } finally {
      await patch(page, `/requests/${SAMS_REQUEST}/pin`, { pinned: false });
    }
  });
});

/**
 * A-3: "Deletes an inappropriate comment." R-37 lets an admin delete any;
 * R-38 says the row stays as a grey line so the thread still makes sense.
 */
test.describe('A-3 · moderating a comment', () => {
  test('deletes somebody else’s comment, and the thread keeps its shape', async ({ browser }) => {
    const body = `Something an admin would remove ${stamp()}`;

    // Sam writes it, in a session of Sam's own.
    const samContext = await browser.newContext();
    const sam = await samContext.newPage();
    await signIn(sam, SAM);
    await sam.goto(`/requests/${SAMS_REQUEST}`);
    await sam.getByRole('textbox', { name: /add a comment/i }).fill(body);
    await sam.getByRole('button', { name: /add comment/i }).click();
    await expect(sam.getByText(body)).toBeVisible();
    await samContext.close();

    // The admin removes it.
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await signIn(admin, ADMIN);
    await admin.goto(`/requests/${SAMS_REQUEST}`);

    const row = admin.getByRole('listitem').filter({ hasText: body });
    await row.getByRole('button', { name: /delete comment/i }).click();

    // R-38: the text is gone for good, and the row is still there.
    await expect(admin.getByText(body)).toBeHidden();
    await expect(admin.getByText('This comment was deleted.').first()).toBeVisible();

    // It stays gone on a reload — the server did it, not the screen.
    await admin.reload();
    await expect(admin.getByText(body)).toBeHidden();
    await adminContext.close();
  });

  /**
   * R-40, R-41: with approval switched on, a new comment waits, and the admin
   * queue is where it is dealt with. The switch is put back at the end however
   * the test ends, because leaving it on would change every later test.
   */
  test('approves a waiting comment (R-40, R-41)', async ({ browser }) => {
    // Deliberately not the words "waiting for approval": the marker this test
    // looks for uses them, and a body that repeated them would make the two
    // impossible to tell apart.
    const body = `A comment for an admin to let through ${stamp()}`;

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await signIn(admin, ADMIN);
    const before = await readAppSettings(admin);

    try {
      await writeAppSettings(admin, { commentsRequireApproval: true });

      const samContext = await browser.newContext();
      const sam = await samContext.newPage();
      await signIn(sam, SAM);
      await sam.goto(`/requests/${SAMS_REQUEST}`);
      await sam.getByRole('textbox', { name: /add a comment/i }).fill(body);
      await sam.getByRole('button', { name: /add comment/i }).click();

      // R-40: the writer sees their own, marked. Scoped to this comment's own
      // row — a run that stopped half way through can leave other comments
      // waiting, and a page-wide match would then be true whatever this test
      // did.
      const mine = sam.getByRole('listitem').filter({ hasText: body });
      await expect(mine).toBeVisible();
      await expect(mine.getByText(/waiting for approval/i)).toBeVisible();

      // The admin finds it in the queue and lets it through.
      await admin.goto('/admin/comments');
      const waiting = admin.getByRole('listitem').filter({ hasText: body });
      await waiting.getByRole('button', { name: /approve the comment/i }).click();
      await expect(admin.getByText(body)).toBeHidden();

      // R-41: approved means it appears, and the mark is gone from this row.
      await sam.reload();
      const approved = sam.getByRole('listitem').filter({ hasText: body });
      await expect(approved).toBeVisible();
      await expect(approved.getByText(/waiting for approval/i)).toHaveCount(0);
      await samContext.close();
    } finally {
      await writeAppSettings(admin, {
        commentsRequireApproval: before.commentsRequireApproval,
      });
      await adminContext.close();
    }
  });
});

/**
 * A-4: "Adds a new category and retires an unused one." R-45 is the one that
 * matters: retiring hides it from the picker, and the requests that already
 * use it still show it correctly.
 */
test.describe('A-4 · categories and statuses', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN);
  });

  test('adds a category, retires it, and brings it back', async ({ page }) => {
    const name = `E2E category ${stamp()}`;

    await page.goto('/admin/taxonomy');
    await page.getByLabel('New category').fill(name);
    await page.getByRole('button', { name: 'Add category' }).click();

    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText('0 requests')).toBeVisible();

    // A brand new category is in nobody's way, so it can be picked.
    await page.goto('/requests/new');
    await expect(page.getByLabel('Category').getByRole('option', { name })).toBeAttached();

    // Retire it, and it leaves the picker (R-45).
    await page.goto('/admin/taxonomy');
    await page.getByRole('button', { name: `Retire ${name}` }).click();
    await expect(page.getByRole('button', { name: `Bring back ${name}` })).toBeVisible();

    await page.goto('/requests/new');
    await expect(page.getByLabel('Category').getByRole('option', { name })).toHaveCount(0);

    // Tidy up: nothing uses it, so it can really go.
    await page.goto('/admin/taxonomy');
    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);
  });

  /**
   * R-45 from the other side, and the reason the seed has a retired category:
   * an old request still names it, correctly, long after nobody can pick it.
   */
  test('shows a retired category correctly on the request that uses it', async ({ page }) => {
    // Straight to the address: this is about the chip, and the seeded request
    // drifts off the first page as the suite files more of its own.
    await page.goto('/requests/00000000-0000-4000-8000-0000000f0004');

    await expect(page.locator('fh-taxonomy-chip').filter({ hasText: 'Legacy' })).toBeVisible();
    // R-45: it says it is retired, so nobody reads it as a category they could
    // still pick.
    await expect(page.getByText('(retired)')).toBeVisible();
  });

  /**
   * R-46: deleting one that is in use is refused — by the database, not by a
   * hidden button. The screen does not offer Delete on a row in use, which is
   * the same rule said kindly, so that absence is what there is to check.
   */
  test('does not offer Delete on a category something uses (R-46)', async ({ page }) => {
    await page.goto('/admin/taxonomy');

    const inUse = page.getByRole('row').filter({ hasText: 'Feature' });
    await expect(inUse.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
    await expect(inUse.getByRole('button', { name: /^Retire/ })).toBeVisible();
  });

  /** R-48: the first status can never be retired, so there is no button. */
  test('offers no way to retire the first status (R-48)', async ({ page }) => {
    await page.goto('/admin/taxonomy');

    const first = page.getByRole('row').filter({ hasText: 'First status' });
    await expect(first).toBeVisible();
    await expect(first.getByRole('button', { name: /^Retire/ })).toHaveCount(0);
  });
});

/**
 * A-5: "Adjusts application-wide settings… It works right away, with no
 * restart." The comments switch is journey A-5 and hard part H-5 at once, so
 * it has a file of its own; what is left here is the rest of the screen.
 */
test.describe('A-5 · application settings', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN);
  });

  test('saves a rate limit, and says so', async ({ page }) => {
    const before = await readAppSettings(page);

    try {
      await page.goto('/admin/settings');
      await page.getByLabel('New requests per person').fill(String(before.submissionLimitCount + 1));
      await page.getByLabel('New requests per person').blur();

      await expect(page.getByText(/in use straight away/i)).toBeVisible();

      await page.reload();
      await expect(page.getByLabel('New requests per person')).toHaveValue(
        String(before.submissionLimitCount + 1),
      );
    } finally {
      await writeAppSettings(page, { submissionLimitCount: before.submissionLimitCount });
    }
  });

  /** R-130: the smallest limit is 1, and the person is told before the trip. */
  test('refuses a limit of zero, in place', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.getByLabel('Votes and un-votes per person').fill('0');
    await page.getByLabel('Votes and un-votes per person').blur();

    await expect(page.getByText(/at least 1/i)).toBeVisible();
  });

  test('changes who may join', async ({ page }) => {
    const before = await readAppSettings(page);

    try {
      await page.goto('/admin/settings');
      await page.getByLabel('Sign-up rule').selectOption('invite_only');

      await expect(page.getByText(/in use straight away/i)).toBeVisible();

      // R-66: with invitations in play, the admin has a screen for them.
      await page.goto('/admin/invitations');
      await expect(page.getByLabel('Invite an address')).toBeVisible();
    } finally {
      await writeAppSettings(page, { registrationPolicy: before.registrationPolicy });
    }
  });
});
