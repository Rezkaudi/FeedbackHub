import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { BootstrapStore } from './core/bootstrap/bootstrap.store';
import { Session } from './core/auth/session';
import type { ApiError } from './core/error/api-error';

/**
 * SRS 15.8, the start-up cases. The rule the whole component exists to keep:
 * "an error page with a Try again button. Never a spinner forever, never a
 * white page."
 *
 * Queried by role and by visible text, never by class or internals — what a
 * person can see and reach is the thing being tested.
 */
describe('what the app shows while it is starting', () => {
  function bootstrapIn(status: string, error: Partial<ApiError> | null = null) {
    return {
      status: signal(status),
      error: signal(error),
      load: vi.fn(),
    };
  }

  async function renderWith(store: ReturnType<typeof bootstrapIn>) {
    await render(App, {
      providers: [provideRouter([]), { provide: BootstrapStore, useValue: store }],
    });
    return store;
  }

  it('says it is starting, and says it somewhere a screen reader will hear', async () => {
    await renderWith(bootstrapIn('loading'));

    // role=status, so the announcement happens without stealing focus (R-92).
    expect(screen.getByRole('status')).toHaveTextContent(/starting/i);
  });

  describe('when the start-up call failed', () => {
    const failure: Partial<ApiError> = {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong.',
      requestId: 'req_abc123',
      status: 500,
      isRetryable: true,
    };

    it('shows what happened instead of a spinner that never stops', async () => {
      await renderWith(bootstrapIn('failed', failure));

      expect(screen.getByRole('heading', { name: /could not start/i })).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('offers a Try again button that actually asks again (R-87)', async () => {
      const store = await renderWith(bootstrapIn('failed', failure));

      await userEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(store.load).toHaveBeenCalledTimes(1);
    });

    /** R-100: the id is given to the person so support can find the call. */
    it('shows the id to quote when asking for help', async () => {
      await renderWith(bootstrapIn('failed', failure));

      expect(screen.getByText(/req_abc123/)).toBeInTheDocument();
    });

    /**
     * R-87: an error says whether trying again helps. Offering the button when
     * it cannot help is worse than not offering it — the person keeps pressing
     * something that was never going to work.
     */
    it('does not offer a retry for a failure that will fail the same way', async () => {
      await renderWith(bootstrapIn('failed', { ...failure, isRetryable: false }));

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('never shows a raw status code or a stack (R-87, R-100)', async () => {
      await renderWith(bootstrapIn('failed', failure));

      expect(document.body.textContent).not.toContain('500');
      expect(document.body.textContent).not.toContain('INTERNAL_ERROR');
    });
  });

  /**
   * A signed-out person is not an error: no "could not start" heading, no
   * spinner. The router outlet is still mounted — authGuard sends them to the
   * identity provider off the protected routes, while the public ones
   * (sign-in-problem) need the outlet to draw at all. Before this, `signedOut`
   * matched no `@case` and the outlet was never rendered, so /sign-in-problem
   * was a white page.
   */
  it('is not treated as a start-up error when the person is signed out', async () => {
    await renderWith(bootstrapIn('signedOut'));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /could not start/i })).not.toBeInTheDocument();
  });
});

/**
 * SRS 15.8: "back to sign-in, and we remember which page they wanted." The
 * page they wanted is stashed by `Session.signIn` before the redirect to
 * Keycloak and must be resumed once the app comes back up signed in — this
 * closes the loop that `Session.takeReturnUrl` existed to serve.
 */
describe('resuming the page a signed-out visit was headed for', () => {
  it('navigates to the stored return URL once the app is ready', async () => {
    const navigateByUrl = vi.fn();

    await render(App, {
      providers: [
        provideRouter([]),
        { provide: BootstrapStore, useValue: { status: signal('ready'), error: signal(null), load: vi.fn() } },
        { provide: Session, useValue: { takeReturnUrl: vi.fn().mockReturnValue('/requests/abc') } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });

    expect(navigateByUrl).toHaveBeenCalledWith('/requests/abc');
  });

  it('does nothing when there is no stored return URL', async () => {
    const navigateByUrl = vi.fn();

    await render(App, {
      providers: [
        provideRouter([]),
        { provide: BootstrapStore, useValue: { status: signal('ready'), error: signal(null), load: vi.fn() } },
        { provide: Session, useValue: { takeReturnUrl: vi.fn().mockReturnValue(null) } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });

    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not try to navigate while still loading or signed out', async () => {
    const navigateByUrl = vi.fn();
    const takeReturnUrl = vi.fn().mockReturnValue('/requests/abc');

    await render(App, {
      providers: [
        provideRouter([]),
        { provide: BootstrapStore, useValue: { status: signal('loading'), error: signal(null), load: vi.fn() } },
        { provide: Session, useValue: { takeReturnUrl } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });

    expect(takeReturnUrl).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
