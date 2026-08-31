import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { LocalizedDatePipe } from '../../../../../core/i18n/localized-date.pipe';
import { Button } from '../../../../../shared/ui/button/button';
import type { PendingComment } from '../../../admin.store';

@Component({
  selector: 'fh-pending-comment-card',
  imports: [TranslatePipe, LocalizedDatePipe, Button],
  templateUrl: './pending-comment-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingCommentCard {
  public readonly comment = input.required<PendingComment>();

  public readonly approved = output<void>();
  public readonly rejected = output<void>();
}
