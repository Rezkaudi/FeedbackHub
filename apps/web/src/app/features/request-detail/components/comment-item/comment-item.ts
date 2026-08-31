import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nStore } from '../../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/i18n/localized-date.pipe';
import { RelativeTimePipe } from '../../../../core/i18n/relative-time.pipe';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { IconButton } from '../../../../shared/ui/icon-button/icon-button';
import type { Comment } from '../../comments.store';

@Component({
  selector: 'fh-comment-item',
  imports: [TranslatePipe, LocalizedDatePipe, RelativeTimePipe, Avatar, IconButton],
  templateUrl: './comment-item.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentItem {
  private readonly i18n = inject(I18nStore);

  public readonly comment = input.required<Comment>();
  public readonly canDelete = input<boolean>(false);

  public readonly removed = output<void>();

  protected deleteLabel(): string {
    return this.i18n.translate('requestDetail.commentDeleteLabel', { name: this.comment().authorName });
  }
}
