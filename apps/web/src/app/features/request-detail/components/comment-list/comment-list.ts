import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Button } from '../../../../shared/ui/button/button';
import { CommentItem } from '../comment-item/comment-item';
import type { Comment } from '../../comments.store';

@Component({
  selector: 'fh-comment-list',
  imports: [TranslatePipe, Button, CommentItem],
  templateUrl: './comment-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentList {
  public readonly items = input.required<readonly Comment[]>();
  public readonly canDeleteAny = input<boolean>(false);
  public readonly hasMore = input<boolean>(false);

  public readonly removed = output<string>();
  public readonly loadedMore = output<void>();
}
