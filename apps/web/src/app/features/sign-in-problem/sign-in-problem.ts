import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * SRS 15.8: sign-in can fail in three different ways and they must not look the
 * same. The server redirects here with `?problem=`, and the values come from
 * the API's auth controller.
 *
 * The distinction that matters most is "you may not join" against "you were
 * unlucky with the timing". The second person *is* allowed — the sign-up limit
 * was simply full at that moment (R-130) — and telling them they are not
 * allowed would be false.
 *
 * This route is deliberately outside the shell and behind no guard: the person
 * is not signed in, so a guard here would send them back to the identity
 * provider and round and round.
 */
@Component({
  selector: 'fh-sign-in-problem',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 class="text-xl">{{ heading() }}</h1>
      <p class="text-muted">{{ explanation() }}</p>
      <a
        href="/v1/auth/sign-in"
        class="bg-accent text-on-accent inline-flex min-h-11 items-center justify-center rounded px-4 font-medium"
      >
        Try signing in again
      </a>
    </main>
  `,
})
export class SignInProblem {
  /** Bound from the query string by withComponentInputBinding(). */
  public readonly problem = input<string>('');
  public readonly reason = input<string>('');

  protected heading(): string {
    return this.problem() === 'cannot_join' ? 'You cannot join FeedbackHub' : 'Signing in failed';
  }

  protected explanation(): string {
    if (this.problem() === 'cannot_join_yet') {
      // They are allowed. Do not tell them otherwise.
      return 'FeedbackHub is busy setting up new accounts right now. Please try again in a little while.';
    }

    if (this.problem() === 'cannot_join') {
      switch (this.reason()) {
        case 'policy_invite_only':
          return 'FeedbackHub is invite only at the moment. Ask an admin to invite your address.';
        case 'policy_domain':
          return 'FeedbackHub only accepts accounts from certain email domains. Yours is not one of them.';
        case 'email_not_verified':
          return 'Your email address has not been verified yet. Verify it with your sign-in provider, then try again.';
        default:
          return 'Your account is not allowed to join FeedbackHub.';
      }
    }

    return 'Something went wrong while signing you in. Trying again usually works.';
  }
}
