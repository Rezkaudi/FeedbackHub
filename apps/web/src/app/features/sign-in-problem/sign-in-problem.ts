import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TranslationKey } from '../../core/i18n/i18n.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'fh-sign-in-problem',
  imports: [TranslatePipe],
  templateUrl: './sign-in-problem.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInProblem {
  public readonly problem = input<string>('');
  public readonly reason = input<string>('');

  /**
   * The one action always goes to `/v1/auth/sign-in`. Only the wording changes:
   * `cannot_join` is a permanent no for this address, so "try again" would be a
   * lie — the useful move is a different account (and the server has already
   * ended the provider session, so the next attempt really is a fresh login).
   * The other two are worth retrying as-is.
   */
  protected readonly action = computed<TranslationKey>(() =>
    this.problem() === 'cannot_join'
      ? 'signInProblem.tryDifferentAccount'
      : 'signInProblem.tryAgain',
  );

  protected readonly heading = computed<TranslationKey>(() => {
    if (this.problem() === 'cannot_join_yet') {
      return 'signInProblem.headingCannotJoinYet';
    }

    if (this.problem() === 'cannot_join') {
      return 'signInProblem.headingCannotJoin';
    }

    return 'signInProblem.headingFailed';
  });

  protected readonly explanation = computed<TranslationKey>(() => {
    if (this.problem() === 'cannot_join_yet') {
      return 'signInProblem.explanationBusy';
    }

    if (this.problem() === 'cannot_join') {
      switch (this.reason()) {
        case 'policy_invite_only':
          return 'signInProblem.explanationInviteOnly';
        case 'policy_domain':
          return 'signInProblem.explanationDomain';
        case 'email_not_verified':
          return 'signInProblem.explanationEmailNotVerified';
        default:
          return 'signInProblem.explanationDefault';
      }
    }

    return 'signInProblem.explanationGeneric';
  });
}
