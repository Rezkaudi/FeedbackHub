import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Board } from './board';
import { BoardStore } from './board.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { DevicePreferencesStore } from '../../core/config/device-preferences.store';

/**
 * R-25 through what a person actually sees. The two empty states are the point:
 * "No requests yet. Be the first." is what a new company meets and it must read
 * as an invitation, while "Nothing matches these filters" needs a Clear button.
 * Showing the first when a filter is on is the bug worth a test.
 *
 * Everything is queried by role, label or visible text — never by class or by
 * component internals.
 */
// A catch-all so navigations in the component under test resolve. With no
// routes at all, router.navigate() rejects, and an unhandled rejection in one
// spec file leaks into the whole run — it poisoned the admin and board suites
// before this was added.
const ANY_ROUTE = [{ path: '**', children: [] }];

describe('the board screen', () => {
  const aRequest = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    title: 'Dark mode for the board',
    description: 'It is painful at night.',
    categoryId: 'c1',
    statusId: 's1',
    authorName: 'Sam',
    authorAvatarUrl: null,
    isPinned: false,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    voteCount: 7,
    commentCount: 2,
    viewerHasVoted: false,
    isMine: false,
    ...over,
  });

  function boardIn(state: string, over: Record<string, unknown> = {}) {
    return {
      state: signal(state),
      items: signal<unknown[]>([]),
      total: signal(0),
      page: signal(1),
      pageCount: signal(1),
      error: signal(null),
      load: vi.fn().mockResolvedValue(undefined),
      ...over,
    };
  }

  const category = { id: 'c1', name: 'Bug', slug: 'bug', color: '#DC2626', isActive: true };
  const status = {
    id: 's1',
    name: 'New',
    slug: 'new',
    color: '#0369A1',
    isActive: true,
    isDefault: true,
  };

  const bootstrap = {
    commentsEnabled: signal(true),
    // Both lists arrive whole (R-45); the active ones are what a picker offers.
    categories: signal([category]),
    statuses: signal([status]),
    activeCategories: signal([category]),
    activeStatuses: signal([status]),
    categoryById: (id: string) =>
      id === 'c1' ? { id, name: 'Bug', slug: 'bug', color: '#DC2626', isActive: true } : undefined,
    statusById: (id: string) =>
      id === 's1'
        ? { id, name: 'New', slug: 'new', color: '#0369A1', isActive: true, isDefault: true }
        : undefined,
  };

  const preferences = {
    defaultSort: signal('newest'),
    defaultStatusIds: signal([]),
    defaultCategoryIds: signal([]),
    knownStatusIds: () => [],
    knownCategoryIds: () => [],
  };

  async function renderBoard(store: ReturnType<typeof boardIn>) {
    await render(Board, {
      providers: [
        provideRouter(ANY_ROUTE),
        { provide: BootstrapStore, useValue: bootstrap },
        { provide: DevicePreferencesStore, useValue: preferences },
      ],
      // The board provides its own store on the component, so it dies with the
      // route. A TestBed provider would be shadowed by that; this replaces the
      // component-level one, which is the thing under test.
      componentProviders: [{ provide: BoardStore, useValue: store }],
    });
    return store;
  }

  /**
   * R-22 puts the sort in the address, and R-24 lets a saved default stand in
   * when the address says nothing. Either way the control has to agree with the
   * board underneath it.
   *
   * This is here because it was wrong: the select bound its own `value`, which
   * is written before an @for has made any options, so the browser fell back to
   * the first one. The board really was sorted by most votes; the control said
   * "Newest first". An end-to-end run caught it on a real browser.
   */
  describe('the sort control', () => {
    it('shows the sort the board is actually using', async () => {
      preferences.defaultSort.set('most_votes');
      try {
        await renderBoard(boardIn('ready', { items: signal([aRequest()]), total: signal(1) }));

        expect(screen.getByLabelText('Sort')).toHaveValue('most_votes');
      } finally {
        preferences.defaultSort.set('newest');
      }
    });
  });

  describe('while it is loading', () => {
    it('says so, once, rather than making a screen reader read grey boxes', async () => {
      await renderBoard(boardIn('loading'));

      expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    });
  });

  describe('when there are requests', () => {
    it('shows the title as a link to the request', async () => {
      await renderBoard(boardIn('ready', { items: signal([aRequest()]), total: signal(1) }));

      const link = screen.getByRole('link', { name: /dark mode for the board/i });
      expect(link).toHaveAttribute('href', '/requests/r1');
    });

    it('shows the status and the category by name, not by colour alone (R-111)', async () => {
      await renderBoard(boardIn('ready', { items: signal([aRequest()]), total: signal(1) }));

      // Scoped to the row: the same two names are also the filter checkboxes,
      // and asserting on the page as a whole would pass even if the card showed
      // neither.
      const row = within(screen.getByRole('listitem'));
      expect(row.getByText('New')).toBeInTheDocument();
      expect(row.getByText('Bug')).toBeInTheDocument();
    });

    it('shows the vote count and who wrote it', async () => {
      await renderBoard(boardIn('ready', { items: signal([aRequest()]), total: signal(1) }));

      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText(/Sam/)).toBeInTheDocument();
    });

    it('marks a pinned request', async () => {
      await renderBoard(
        boardIn('ready', { items: signal([aRequest({ isPinned: true })]), total: signal(1) }),
      );

      expect(screen.getByText(/pinned/i)).toBeInTheDocument();
    });

    /** R-42: with comments off, the count is gone from the board entirely. */
    it('hides the comment count when comments are switched off', async () => {
      bootstrap.commentsEnabled.set(false);
      await renderBoard(boardIn('ready', { items: signal([aRequest()]), total: signal(1) }));

      expect(screen.queryByText(/2 comments/)).not.toBeInTheDocument();
      bootstrap.commentsEnabled.set(true);
    });
  });

  describe('when there is nothing to show', () => {
    it('invites a new company to write the first one', async () => {
      await renderBoard(boardIn('empty'));

      expect(screen.getByText(/no requests yet/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /write the first/i })).toBeInTheDocument();
    });

    it('says something different when a filter is what hid everything', async () => {
      await renderBoard(boardIn('emptyForFilters'));

      expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
      // Not the new-company message: they are different problems.
      expect(screen.queryByText(/no requests yet/i)).not.toBeInTheDocument();
    });

    it('offers a Clear button only for the filtered empty (R-25)', async () => {
      await renderBoard(boardIn('emptyForFilters'));
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
    });

    it('does not offer Clear when there is simply nothing on the board', async () => {
      await renderBoard(boardIn('empty'));
      expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
    });
  });

  describe('when loading failed', () => {
    const failure = {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong.',
      requestId: 'req_xyz',
      status: 500,
      isRetryable: true,
    };

    it('explains, and offers a retry that asks again', async () => {
      const store = await renderBoard(boardIn('failed', { error: signal(failure) }));

      expect(screen.getByRole('alert')).toHaveTextContent(/could not load the board/i);

      store.load.mockClear();
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(store.load).toHaveBeenCalled();
    });

    /** R-25: "Filters stay as they were." The search box must not be wiped. */
    it('keeps the filter bar on screen so the filters are not lost', async () => {
      await renderBoard(boardIn('failed', { error: signal(failure) }));

      expect(screen.getByRole('searchbox', { name: /search/i })).toBeInTheDocument();
    });

    it('shows no raw status code (R-87, R-100)', async () => {
      await renderBoard(boardIn('failed', { error: signal(failure) }));

      expect(screen.getByRole('alert').textContent).not.toContain('500');
    });
  });

  describe('the filter bar', () => {
    it('offers only categories that are still open for picking (R-45)', async () => {
      await renderBoard(boardIn('ready', { items: signal([aRequest()]), total: signal(1) }));

      expect(screen.getByRole('checkbox', { name: 'Bug' })).toBeInTheDocument();
    });

    it('names the sort control, and offers the four the server accepts', async () => {
      await renderBoard(boardIn('ready', { items: signal([aRequest()]), total: signal(1) }));

      const sort = screen.getByRole('combobox', { name: /sort/i });
      expect(sort).toBeInTheDocument();
      expect(sort.querySelectorAll('option')).toHaveLength(4);
    });

    it('says how many were found, so the count is not only in the rows', async () => {
      await renderBoard(
        boardIn('ready', { items: signal([aRequest()]), total: signal(41), pageCount: signal(3) }),
      );

      expect(screen.getByText(/41/)).toBeInTheDocument();
    });
  });

  describe('the page buttons', () => {
    it('are not shown when everything fits on one page', async () => {
      await renderBoard(
        boardIn('ready', { items: signal([aRequest()]), total: signal(1), pageCount: signal(1) }),
      );

      expect(screen.queryByRole('navigation', { name: /pages/i })).not.toBeInTheDocument();
    });

    it('disable Previous on the first page rather than hiding it', async () => {
      await renderBoard(
        boardIn('ready', {
          items: signal([aRequest()]),
          total: signal(41),
          page: signal(1),
          pageCount: signal(3),
        }),
      );

      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    });

    it('disable Next on the last page', async () => {
      await renderBoard(
        boardIn('ready', {
          items: signal([aRequest()]),
          total: signal(41),
          page: signal(3),
          pageCount: signal(3),
        }),
      );

      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });
  });
});
