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

  protected readonly heading = computed<TranslationKey>(() =>
    this.problem() === 'cannot_join' ? 'signInProblem.headingCannotJoin' : 'signInProblem.headingFailed',
  );

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
