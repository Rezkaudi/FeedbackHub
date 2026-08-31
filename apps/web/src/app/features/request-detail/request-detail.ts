import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RequestDetailStore } from './request-detail.store';
import { CommentsStore } from './comments.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { I18nStore } from '../../core/i18n/i18n.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LocalizedDatePipe } from '../../core/i18n/localized-date.pipe';
import { ConfirmService } from '../../shared/ui/dialog/confirm.service';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { EmptyPanel } from '../../shared/ui/state/empty-panel/empty-panel';
import { ErrorPanel } from '../../shared/ui/state/error-panel/error-panel';
import { SkeletonRows } from '../../shared/ui/state/skeleton-rows/skeleton-rows';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs/breadcrumbs';
import { RequestFormDialog } from '../request-form/request-form-dialog';
import { RequestHeader } from './components/request-header/request-header';
import { RequestVoteButton } from './components/request-vote-button/request-vote-button';
import { CommentForm } from './components/comment-form/comment-form';
import { CommentList } from './components/comment-list/comment-list';

@Component({
  selector: 'fh-request-detail',
  imports: [
    RouterLink,
    TranslatePipe,
    LocalizedDatePipe,
    Breadcrumbs,
    EmptyPanel,
    ErrorPanel,
    SkeletonRows,
    RequestFormDialog,
    RequestHeader,
    RequestVoteButton,
    CommentForm,
    CommentList,
  ],
  providers: [RequestDetailStore, CommentsStore],
  templateUrl: './request-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDetail {
  protected readonly detail = inject(RequestDetailStore);
  protected readonly comments = inject(CommentsStore);
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly i18n = inject(I18nStore);
  private readonly confirm = inject(ConfirmService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);

  public readonly id = input.required<string>();

  protected readonly voting = signal(false);
  protected readonly deleting = signal(false);
  protected readonly editing = signal(false);

  protected readonly crumbs = computed(() => [
    { label: this.i18n.translate('nav.requests'), link: '/' },
    {
      label: this.detail.request()?.title ?? this.i18n.translate('requestDetail.loadingLabel'),
    },
  ]);

  protected readonly status = computed(() =>
    this.bootstrap.statusById(this.detail.request()?.statusId ?? ''),
  );
  protected readonly category = computed(() =>
    this.bootstrap.categoryById(this.detail.request()?.categoryId ?? ''),
  );
  protected readonly canDelete = computed(
    () => (this.detail.request()?.isMine ?? false) || this.bootstrap.isAdmin(),
  );

  public constructor() {
    effect(() => {
      const id = this.id();
      void this.detail.load(id);

      if (this.bootstrap.commentsEnabled()) {
        void this.comments.load(id);
      }
    });
  }

  protected async vote(): Promise<void> {
    if (this.voting()) {
      return;
    }
    this.voting.set(true);
    await this.detail.vote();
    this.voting.set(false);
  }

  protected onEditSaved(): void {
    this.editing.set(false);
    void this.detail.load(this.id());
    this.snackbar.show(this.i18n.translate('snackbar.requestUpdated'));
  }

  protected onDraft(value: string): void {
    this.comments.setDraft(value);
  }

  protected submitComment(): void {
    void this.comments.add();
  }

  protected async removeComment(commentId: string): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('requestDetail.deleteCommentConfirmTitle'),
      message: this.i18n.translate('requestDetail.deleteCommentConfirmMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      cancelLabel: this.i18n.translate('common.cancel'),
      tone: 'danger',
    });

    if (confirmed) {
      void this.comments.remove(commentId);
    }
  }

  protected async removeRequest(): Promise<void> {
    const request = this.detail.request();
    if (request === null || this.deleting()) {
      return;
    }

    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('requestForm.deleteRequestTitle', { title: request.title }),
      message: this.i18n.translate('requestForm.deleteRequestMessage'),
      confirmLabel: this.i18n.translate('requestForm.deleteConfirm'),
      cancelLabel: this.i18n.translate('requestForm.deleteCancel'),
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    const error = await this.detail.deleteRequest();
    this.deleting.set(false);

    if (error === null) {
      this.snackbar.show(this.i18n.translate('snackbar.requestDeleted'));
      void this.router.navigate(['/']);
    }
  }
}
