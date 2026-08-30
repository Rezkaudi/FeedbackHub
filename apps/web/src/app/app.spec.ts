import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { BootstrapStore } from './core/bootstrap/bootstrap.store';
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
   * The guard is already sending them to the identity provider. Drawing any of
   * the app first would be a flash of a screen they are not signed in for.
   */
  it('shows nothing at all while a signed-out person is being redirected', async () => {
    await renderWith(bootstrapIn('signedOut'));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
