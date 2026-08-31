import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RequestCard } from './request-card';
import { BootstrapStore } from '../../../../core/bootstrap/bootstrap.store';
import { BoardStore } from '../../board.store';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';

const ROUTES = [{ path: 'requests/:id', children: [] }];

describe('a request card on the board', () => {
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

  const bootstrap = {
    commentsEnabled: signal(true),
    isAdmin: () => false,
    statusById: () => ({ name: 'New', color: '#0369A1', isActive: true }),
    categoryById: () => ({ name: 'Bug', color: '#DC2626', isActive: true }),
  };

  function board() {
    return {
      deleteRequest: vi.fn().mockResolvedValue(null),
      setPinned: vi.fn().mockResolvedValue(null),
    };
  }

  function providers(bootstrapOverride: typeof bootstrap = bootstrap, boardOverride = board()) {
    return [
      provideRouter(ROUTES),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: BootstrapStore, useValue: bootstrapOverride },
      { provide: BoardStore, useValue: boardOverride },
    ];
  }

  it('shows a pin marker only when pinned', async () => {
    const { rerender } = await render(RequestCard, {
      inputs: { request: aRequest({ isPinned: false }) },
      providers: providers(),
    });
    expect(screen.queryByLabelText('Pinned')).not.toBeInTheDocument();

    await rerender({ inputs: { request: aRequest({ isPinned: true }) } });
    expect(screen.getByLabelText('Pinned')).toBeInTheDocument();
  });

  it('makes the whole card a single link to the request', async () => {
    await render(RequestCard, { inputs: { request: aRequest() }, providers: providers() });

    const link = screen.getByRole('link', { name: 'Dark mode for the board' });
    expect(link).toHaveAttribute('href', '/requests/r1');
  });

  it('hides the comment count when comments are switched off', async () => {
    await render(RequestCard, {
      inputs: { request: aRequest() },
      providers: providers({ ...bootstrap, commentsEnabled: signal(false) }),
    });

    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('votes optimistically and rolls back on failure', async () => {
    const { fixture } = await render(RequestCard, {
      inputs: { request: aRequest({ voteCount: 7, viewerHasVoted: false }) },
      providers: providers(),
    });

    const backend = TestBed.inject(HttpTestingController);
    const button = screen.getByRole('button', { name: /7 votes/i });

    await userEvent.click(button);
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: /8/ })).toBeInTheDocument();

    backend.expectOne('/v1/requests/r1/vote').flush(
      { error: { code: 'INTERNAL_ERROR', message: 'nope', requestId: 'x' } },
      { status: 500, statusText: 'Server Error' },
    );
    await Promise.resolve();
    fixture.detectChanges();

    expect(screen.getByRole('button', { name: /7 votes/i })).toBeInTheDocument();
  });

  describe('deleting', () => {
    async function renderWithConfirm(request: Record<string, unknown>, boardOverride = board()) {
      const utils = await render('<fh-request-card [request]="request" /><fh-confirm-dialog />', {
        imports: [RequestCard, ConfirmDialog],
        componentProperties: { request: aRequest(request) },
        providers: providers(bootstrap, boardOverride),
      });
      return { ...utils, boardOverride };
    }

    it('offers no delete button for someone else\'s request when I am not an admin', async () => {
      await renderWithConfirm({ isMine: false });

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('offers delete for my own request', async () => {
      await renderWithConfirm({ isMine: true });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('offers delete for any request when I am an admin', async () => {
      const admin = { ...bootstrap, isAdmin: () => true };
      await render('<fh-request-card [request]="request" /><fh-confirm-dialog />', {
        imports: [RequestCard, ConfirmDialog],
        componentProperties: { request: aRequest({ isMine: false }) },
        providers: providers(admin),
      });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('asks first, and deletes only after confirming', async () => {
      const boardOverride = board();
      const { fixture } = await renderWithConfirm({ isMine: true }, boardOverride);

      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(boardOverride.deleteRequest).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /delete it/i }));
      await fixture.whenStable();

      expect(boardOverride.deleteRequest).toHaveBeenCalledWith('r1');
    });

    it('does not delete when they change their mind', async () => {
      const boardOverride = board();
      await renderWithConfirm({ isMine: true }, boardOverride);

      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      await userEvent.click(screen.getByRole('button', { name: /keep it/i }));

      expect(boardOverride.deleteRequest).not.toHaveBeenCalled();
    });
  });

  describe('pinning', () => {
    it('offers no pin control to a non-admin', async () => {
      await render(RequestCard, { inputs: { request: aRequest() }, providers: providers() });

      expect(screen.queryByRole('button', { name: /pin/i })).not.toBeInTheDocument();
    });

    it('lets an admin pin an unpinned request, without asking first', async () => {
      const admin = { ...bootstrap, isAdmin: () => true };
      const boardOverride = board();
      const { fixture } = await render(RequestCard, {
        inputs: { request: aRequest({ isPinned: false }) },
        providers: providers(admin, boardOverride),
      });

      await userEvent.click(screen.getByRole('button', { name: /pin to the top/i }));
      await fixture.whenStable();

      expect(boardOverride.setPinned).toHaveBeenCalledWith('r1', true);
    });

    it('lets an admin unpin an already-pinned request', async () => {
      const admin = { ...bootstrap, isAdmin: () => true };
      const boardOverride = board();
      const { fixture } = await render(RequestCard, {
        inputs: { request: aRequest({ isPinned: true }) },
        providers: providers(admin, boardOverride),
      });

      await userEvent.click(screen.getByRole('button', { name: /unpin from the top/i }));
      await fixture.whenStable();

      expect(boardOverride.setPinned).toHaveBeenCalledWith('r1', false);
    });
  });
});
