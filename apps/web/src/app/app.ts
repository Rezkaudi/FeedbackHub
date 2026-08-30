import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BootstrapStore } from './core/bootstrap/bootstrap.store';

/**
 * The root of the app, and the one place that decides what a person sees before
 * the router ever runs.
 *
 * SRS 15.8 names three outcomes for the start-up call and they must look
 * different: a spinner while it is in flight, an error with a Try again button
 * if it failed, and the app itself once it is ready. Never a white page, and
 * never a spinner that spins forever.
 *
 * `signedOut` renders nothing here on purpose — the guard sends the person to
 * the identity provider, and drawing a half-app for a frame first would be a
 * flash of content they are not entitled to.
 */
@Component({
  selector: 'fh-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (bootstrap.status()) {
      @case ('ready') {
        <router-outlet />
      }
      @case ('failed') {
        <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
          <h1 class="text-xl">We could not start FeedbackHub</h1>
          <p class="text-muted">
            {{
              bootstrap.error()?.isRetryable
                ? 'The server did not answer. This is usually temporary.'
                : 'Something went wrong while starting up.'
            }}
          </p>
          @if (bootstrap.error()?.requestId; as requestId) {
            <p class="text-subtle text-sm">
              Quote this id if you ask for help:
              <span class="font-mono">{{ requestId }}</span>
            </p>
          }
          <!-- R-87: only when trying again can actually help. A button that
               cannot work is worse than no button — the person keeps pressing
               it. -->
          @if (bootstrap.error()?.isRetryable) {
            <button
              type="button"
              class="bg-accent text-on-accent min-h-11 rounded px-4 font-medium"
              (click)="retry()"
            >
              Try again
            </button>
          }
        </main>
      }
      @case ('loading') {
        <!-- Announced rather than drawn: there is no page shape to hold yet, so
             a skeleton would be inventing one. -->
        <p role="status" class="p-6 text-muted">Starting FeedbackHub…</p>
      }
    }
  `,
})
export class App {
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly document = inject(DOCUMENT);

  /**
   * SRS 15.8: the Try again button must actually recover the app, not just clear
   * the message. The router cancelled its first navigation when the guard saw a
   * failed start-up, and a signal turning 'ready' does not re-run it — so once
   * the one start-up call succeeds, reload the page to let the router resolve
   * the route cleanly.
   */
  protected async retry(): Promise<void> {
    await this.bootstrap.load();
    if (this.bootstrap.status() === 'ready') {
      this.document.defaultView?.location.reload();
    }
  }
}
