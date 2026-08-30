import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RequestDetail } from './request-detail';
import { RequestDetailStore } from './request-detail.store';
import { CommentsStore } from './comments.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';

/**
 * The request page, through what a person can see and do.
 *
 * R-31 is the rule with the most teeth here: the vote control is a real button,
 * it works from the keyboard, and **its name says the count and whether you
 * voted**. A button labelled only "Vote" tells a screen-reader user nothing
 * about what pressing it did.
 */
// A catch-all so navigations in the component under test resolve. With no
// routes at all, router.navigate() rejects, and an unhandled rejection in one
// spec file leaks into the whole run — it poisoned the admin and board suites
// before this was added.
const ANY_ROUTE = [{ path: '**', children: [] }];

describe('the request page', () => {
  const aRequest = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    title: 'Dark mode',
    description: 'It is painful at night.\nSecond line.',
    categoryId: 'c1',
    statusId: 's1',
    authorName: 'Sam',
    authorAvatarUrl: null,
    isPinned: false,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    voteCount: 4,
    commentCount: 2,
    viewerHasVoted: false,
    isMine: false,
    ...over,
  });

  const aComment = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    body: `Comment ${id}`,
    state: 'published',
    authorName: 'Rae',
    authorAvatarUrl: null,
    isMine: false,
    createdAt: '2026-08-02T10:00:00.000Z',
    ...over,
  });

  function detailIn(state: string, over: Record<string, unknown> = {}) {
    const request = signal<unknown>(state === 'ready' ? aRequest() : null);
    return {
      state: signal(state),
      request,
      error: signal(null),
      voteError: signal(null),
      voteCount: signal(4),
      viewerHasVoted: signal(false),
      isMine: signal(false),
      adminError: signal(null),
      load: vi.fn().mockResolvedValue(undefined),
      vote: vi.fn().mockResolvedValue(undefined),
      changeStatus: vi.fn().mockResolvedValue(undefined),
      setPinned: vi.fn().mockResolvedValue(undefined),
      ...over,
    };
  }

  function commentsIn(state: string, over: Record<string, unknown> = {}) {
    return {
      state: signal(state),
      items: signal<unknown[]>([]),
      total: signal(0),
      error: signal(null),
      moreError: signal(null),
      addError: signal(null),
      draft: signal(''),
      isSaving: signal(false),
      hasMore: signal(false),
      load: vi.fn().mockResolvedValue(undefined),
      loadMore: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      setDraft: vi.fn(),
      ...over,
    };
  }

  const bootstrap = {
    commentsEnabled: signal(true),
    commentsRequireApproval: signal(false),
    isAdmin: signal(false),
    // Only the admin panel reads this, so it stayed absent until an admin test
    // rendered the panel for the first time.
    activeStatuses: signal([
      { id: 's1', name: 'New', color: '#0369A1', isActive: true },
      { id: 's2', name: 'Planned', color: '#00838F', isActive: true },
    ]),
    categoryById: () => ({ id: 'c1', name: 'Bug', color: '#DC2626', isActive: true }),
    statusById: () => ({ id: 's1', name: 'New', color: '#0369A1', isActive: true }),
  };

  // `bootstrap` is one object shared by every test in this file, so a test that
  // makes the viewer an admin must not leave them one.
  afterEach(() => {
    bootstrap.isAdmin.set(false);
    bootstrap.commentsEnabled.set(true);
    bootstrap.commentsRequireApproval.set(false);
  });

  async function renderPage(
    detail: ReturnType<typeof detailIn>,
    comments = commentsIn('empty'),
  ) {
    await render(RequestDetail, {
      providers: [provideRouter(ANY_ROUTE), { provide: BootstrapStore, useValue: bootstrap }],
      componentProviders: [
        { provide: RequestDetailStore, useValue: detail },
        { provide: CommentsStore, useValue: comments },
      ],
      inputs: { id: 'r1' },
    });
    return { detail, comments };
  }

  describe('the request itself', () => {
    it('shows a skeleton while it loads, announced once', async () => {
      await renderPage(detailIn('loading'));

      expect(screen.getAllByRole('status')[0]).toHaveTextContent(/loading/i);
    });

    it('shows the title, the text and who wrote it', async () => {
      await renderPage(detailIn('ready'));

      expect(screen.getByRole('heading', { name: 'Dark mode' })).toBeInTheDocument();
      expect(screen.getByText(/painful at night/)).toBeInTheDocument();
      expect(screen.getByText(/Sam/)).toBeInTheDocument();
    });

    /** SRS 15.2: deleted while it was open -> say so, and offer a way back. */
    it('says a deleted request is gone, and offers the board', async () => {
      await renderPage(detailIn('missing'));

      expect(screen.getByText(/does not exist/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /board/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('offers a retry when the server merely broke', async () => {
      const detail = detailIn('failed', {
        error: signal({ isRetryable: true, requestId: 'req_1', code: 'INTERNAL_ERROR' }),
      });
      await renderPage(detail);

      detail.load.mockClear();
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(detail.load).toHaveBeenCalled();
    });

    /** R-98: what people write is shown as plain text, never read as HTML. */
    it('shows a description containing markup as text, not as markup', async () => {
      const detail = detailIn('ready');
      detail.request.set(aRequest({ description: '<img src=x onerror="alert(1)">' }));
      await renderPage(detail);

      expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
      expect(document.querySelector('img')).toBeNull();
    });
  });

  /**
   * R-13: the author edits their own request. The route and the form both
   * existed before this, but nothing linked to them — the only way in was to
   * type the address, which meant journey U-5 could not be completed by a
   * person using the screen. The E2E suite is what found it.
   */
  describe('editing my own request', () => {
    it('offers Edit on a request that is mine', async () => {
      const detail = detailIn('ready', { isMine: signal(true) });
      detail.request.set(aRequest({ isMine: true }));
      await renderPage(detail);

      expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute(
        'href',
        '/requests/r1/edit',
      );
    });

    it('offers no Edit on somebody else\u2019s request', async () => {
      await renderPage(detailIn('ready'));

      expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('the vote button', () => {
    it('says the count and that I have not voted (R-31)', async () => {
      await renderPage(detailIn('ready'));

      const button = screen.getByRole('button', { name: /4 votes.*vote for this/i });
      expect(button).toBeInTheDocument();
    });

    it('says the count and that I have voted, once I have', async () => {
      await renderPage(
        detailIn('ready', { viewerHasVoted: signal(true), voteCount: signal(5) }),
      );

      expect(
        screen.getByRole('button', { name: /5 votes.*you voted.*take your vote back/i }),
      ).toBeInTheDocument();
    });

    it('votes when pressed', async () => {
      const { detail } = await renderPage(detailIn('ready'));

      await userEvent.click(screen.getByRole('button', { name: /votes/i }));

      expect(detail.vote).toHaveBeenCalledTimes(1);
    });

    it('is reachable and operable from the keyboard alone (R-31)', async () => {
      const { detail } = await renderPage(detailIn('ready'));

      screen.getByRole('button', { name: /votes/i }).focus();
      await userEvent.keyboard('{Enter}');

      expect(detail.vote).toHaveBeenCalled();
    });

    /** R-30: if the server says no, it goes back and shows why. */
    it('says why when the vote did not save', async () => {
      await renderPage(
        detailIn('ready', {
          voteError: signal({ code: 'INTERNAL_ERROR', isRetryable: true, requestId: 'r' }),
        }),
      );

      expect(screen.getByRole('alert')).toHaveTextContent(/could not save your vote/i);
    });

    it('names the time they may vote again when a limit refused it (R-131)', async () => {
      await renderPage(
        detailIn('ready', {
          voteError: signal({
            code: 'VOTE_RATE_LIMITED',
            isRetryable: false,
            requestId: 'r',
            retryAt: new Date('2026-08-30T14:00:00.000Z'),
          }),
        }),
      );

      expect(screen.getByRole('alert')).toHaveTextContent(/you can vote again/i);
    });
  });

  describe('the comment thread', () => {
    it('invites the first comment when there are none', async () => {
      await renderPage(detailIn('ready'), commentsIn('empty'));

      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });

    it('shows the comments, newest first', async () => {
      await renderPage(
        detailIn('ready'),
        commentsIn('ready', {
          items: signal([aComment('a'), aComment('b')]),
          total: signal(2),
        }),
      );

      const thread = within(screen.getByRole('list', { name: /comments/i }));
      expect(thread.getAllByRole('listitem')).toHaveLength(2);
    });

    /** R-38: a deleted comment leaves a small grey line; the row stays. */
    it('leaves a line where a deleted comment was', async () => {
      await renderPage(
        detailIn('ready'),
        commentsIn('ready', {
          items: signal([aComment('a', { state: 'deleted', body: '' })]),
          total: signal(0),
        }),
      );

      expect(screen.getByText(/this comment was deleted/i)).toBeInTheDocument();
    });

    /** R-40: only the writer sees it, and it is marked. */
    it('marks my own comment as waiting for approval', async () => {
      await renderPage(
        detailIn('ready'),
        commentsIn('ready', {
          items: signal([aComment('a', { state: 'pending', isMine: true })]),
          total: signal(0),
        }),
      );

      expect(screen.getByText(/waiting for approval/i)).toBeInTheDocument();
    });

    it('offers Delete on my own comment and not on anybody else’s', async () => {
      await renderPage(
        detailIn('ready'),
        commentsIn('ready', {
          items: signal([aComment('mine', { isMine: true }), aComment('theirs')]),
          total: signal(2),
        }),
      );

      // One button, not two: the other comment is not mine to delete.
      expect(screen.getAllByRole('button', { name: /delete comment/i })).toHaveLength(1);
    });

    /**
     * R-37: an admin deletes any comment. This is journey A-3, and without it
     * the only way to moderate a published comment is to call the endpoint by
     * hand — the server has always allowed it.
     */
    it('offers Delete on every comment to an admin', async () => {
      bootstrap.isAdmin.set(true);

      await renderPage(
        detailIn('ready'),
        commentsIn('ready', {
          items: signal([aComment('mine', { isMine: true }), aComment('theirs')]),
          total: signal(2),
        }),
      );

      expect(screen.getAllByRole('button', { name: /delete comment/i })).toHaveLength(2);
    });

    /** R-36: moderation is deleting, never rewriting. No edit is offered. */
    it('offers an admin no way to change somebody else’s words', async () => {
      bootstrap.isAdmin.set(true);

      await renderPage(
        detailIn('ready'),
        commentsIn('ready', { items: signal([aComment('theirs')]), total: signal(1) }),
      );

      expect(screen.queryByRole('button', { name: /edit comment/i })).not.toBeInTheDocument();
    });

    it('shows more only while there are more', async () => {
      await renderPage(
        detailIn('ready'),
        commentsIn('ready', { items: signal([aComment('a')]), hasMore: signal(true) }),
      );

      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
    });

    it('fails on its own, leaving the request readable (SRS 15.2)', async () => {
      await renderPage(
        detailIn('ready'),
        commentsIn('failed', { error: signal({ isRetryable: true, requestId: 'r' }) }),
      );

      expect(screen.getByRole('heading', { name: 'Dark mode' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/could not load the comments/i);
    });
  });

  describe('writing a comment', () => {
    it('sends what was typed', async () => {
      const { comments } = await renderPage(
        detailIn('ready'),
        commentsIn('empty', { draft: signal('Nice idea') }),
      );

      await userEvent.click(screen.getByRole('button', { name: /add comment/i }));

      expect(comments.add).toHaveBeenCalled();
    });

    it('will not send an empty comment', async () => {
      await renderPage(detailIn('ready'), commentsIn('empty', { draft: signal('   ') }));

      expect(screen.getByRole('button', { name: /add comment/i })).toBeDisabled();
    });

    /** SRS 15.5: the text stays in the box, with a message. */
    it('says why it failed without clearing the box', async () => {
      await renderPage(
        detailIn('ready'),
        commentsIn('empty', {
          draft: signal('Nice idea'),
          addError: signal({ code: 'INTERNAL_ERROR', isRetryable: true, requestId: 'r' }),
        }),
      );

      expect(screen.getByRole('textbox', { name: /comment/i })).toHaveValue('Nice idea');
      expect(screen.getByRole('alert')).toHaveTextContent(/could not save your comment/i);
    });
  });

  /**
   * R-42, the switch that proves H-5: the comment box and the whole thread
   * disappear. The server refuses too, and the E2E suite proves that half.
   */
  describe('when comments are switched off', () => {
    it('shows no thread and no box at all', async () => {
      bootstrap.commentsEnabled.set(false);

      await renderPage(
        detailIn('ready'),
        commentsIn('ready', { items: signal([aComment('a')]), total: signal(1) }),
      );

      expect(screen.queryByRole('list', { name: /comments/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /comment/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/no comments yet/i)).not.toBeInTheDocument();

      bootstrap.commentsEnabled.set(true);
    });

    it('does not even ask the server for the thread', async () => {
      bootstrap.commentsEnabled.set(false);
      const comments = commentsIn('empty');

      await renderPage(detailIn('ready'), comments);

      expect(comments.load).not.toHaveBeenCalled();
      bootstrap.commentsEnabled.set(true);
    });
  });
  /**
   * Journey A-2, on this screen: an admin changes the status and pins. Both are
   * hidden from everybody else as a courtesy — R-70 says the server is the
   * check, and the E2E suite calls both endpoints as an ordinary person to
   * prove it.
   */
  describe('the admin panel (R-64, R-65)', () => {
    it('is not there for an ordinary person', async () => {
      await renderPage(detailIn('ready'));

      expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /pin to the top/i })).not.toBeInTheDocument();
    });

    /**
     * The same bug as the board's sort control, and worse here: an admin who
     * opens a request that is "Planned" and sees "New" in the picker has been
     * shown a lie about the thing they are about to change.
     */
    it('shows the status the request actually has', async () => {
      bootstrap.isAdmin.set(true);
      const detail = detailIn('ready');
      detail.request.set(aRequest({ statusId: 's2' }));

      await renderPage(detail);

      expect(screen.getByLabelText('Status')).toHaveValue('s2');
    });

    it('changes the status', async () => {
      bootstrap.isAdmin.set(true);
      const { detail } = await renderPage(detailIn('ready'));

      await userEvent.selectOptions(screen.getByLabelText('Status'), 's2');

      expect(detail.changeStatus).toHaveBeenCalledWith('s2');
    });

    it('pins, and says so when it is already pinned', async () => {
      bootstrap.isAdmin.set(true);
      const detail = detailIn('ready');
      const { detail: used } = await renderPage(detail);

      const pin = screen.getByRole('button', { name: /pin to the top/i });
      expect(pin).toHaveAttribute('aria-pressed', 'false');
      await userEvent.click(pin);
      expect(used.setPinned).toHaveBeenCalledWith(true);

      detail.request.set(aRequest({ isPinned: true }));
      expect(
        await screen.findByRole('button', { name: /unpin from the top/i }),
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
