import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminStore, type PendingComment } from '../admin.store';
import { I18nStore } from '../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../shared/ui/dialog/confirm.service';
import { ErrorPanel } from '../../../shared/ui/state/error-panel/error-panel';
import { SkeletonRows } from '../../../shared/ui/state/skeleton-rows/skeleton-rows';
import { EmptyPanel } from '../../../shared/ui/state/empty-panel/empty-panel';
import { PendingCommentCard } from './components/pending-comment-card/pending-comment-card';

@Component({
  selector: 'fh-pending-comments',
  imports: [TranslatePipe, ErrorPanel, SkeletonRows, EmptyPanel, PendingCommentCard],
  templateUrl: './pending-comments.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingComments {
  protected readonly admin = inject(AdminStore);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nStore);

  public constructor() {
    void this.admin.loadPending();
  }

  protected async approve(comment: PendingComment): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('admin.approveConfirmTitle'),
      message: this.i18n.translate('admin.approveConfirmMessage'),
      confirmLabel: this.i18n.translate('admin.approve'),
    });
    if (confirmed) {
      void this.admin.approveComment(comment.id);
    }
  }

  protected async reject(comment: PendingComment): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('admin.rejectConfirmTitle'),
      message: this.i18n.translate('admin.rejectConfirmMessage'),
      confirmLabel: this.i18n.translate('admin.reject'),
      tone: 'danger',
    });
    if (confirmed) {
      void this.admin.rejectComment(comment.id);
    }
  }
}
