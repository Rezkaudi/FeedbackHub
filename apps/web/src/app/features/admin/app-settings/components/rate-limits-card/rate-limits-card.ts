import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { Field } from '../../../../../shared/ui/field/field';
import { SectionCard } from '../../../../../shared/ui/section-card/section-card';
import type { AppSettings } from '../../../admin.store';

type LimitField =
  | 'submissionLimitCount'
  | 'submissionLimitMinutes'
  | 'voteLimitCount'
  | 'voteLimitMinutes'
  | 'signupLimitCount'
  | 'signupLimitMinutes';

@Component({
  selector: 'fh-rate-limits-card',
  imports: [TranslatePipe, Field, SectionCard],
  templateUrl: './rate-limits-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RateLimitsCard {
  public readonly settings = input.required<AppSettings>();

  public readonly limitChanged = output<{ field: LimitField; value: number }>();

  protected readonly tooSmall = signal(false);

  protected readonly limits = [
    {
      label: 'admin.submissionLimit',
      countId: 'submissionLimitCount',
      minutesId: 'submissionLimitMinutes',
    },
    { label: 'admin.voteLimit', countId: 'voteLimitCount', minutesId: 'voteLimitMinutes' },
    { label: 'admin.signupLimit', countId: 'signupLimitCount', minutesId: 'signupLimitMinutes' },
  ] as const satisfies readonly { label: string; countId: LimitField; minutesId: LimitField }[];

  protected value(field: LimitField): number {
    return this.settings()[field];
  }

  protected onChange(field: LimitField, event: Event): void {
    const parsed = Number((event.target as HTMLInputElement).value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      this.tooSmall.set(true);
      return;
    }

    this.tooSmall.set(false);
    this.limitChanged.emit({ field, value: parsed });
  }
}
