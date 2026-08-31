import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaxonomyChip } from '../../../../shared/ui/chip/taxonomy-chip';
import { IconButton } from '../../../../shared/ui/icon-button/icon-button';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Spinner } from '../../../../shared/ui/spinner/spinner';
import { BootstrapStore } from '../../../../core/bootstrap/bootstrap.store';
import { I18nStore } from '../../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/i18n/localized-date.pipe';
import { RelativeTimePipe } from '../../../../core/i18n/relative-time.pipe';
import { VoteService, type VotePatch } from '../../../../core/requests/vote.service';
import { ConfirmService } from '../../../../shared/ui/dialog/confirm.service';
import { BoardStore, type RequestRow } from '../../board.store';

@Component({
  selector: 'fh-request-card',
  imports: [
    RouterLink,
    TaxonomyChip,
    IconButton,
    Avatar,
    Icon,
    Spinner,
    TranslatePipe,
    LocalizedDatePipe,
    RelativeTimePipe,
  ],
  templateUrl: './request-card.html',
  styleUrl: './request-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestCard {
  private readonly bootstrap = inject(BootstrapStore);
  private readonly i18n = inject(I18nStore);
  private readonly voteService = inject(VoteService);
  private readonly board = inject(BoardStore);
  private readonly confirm = inject(ConfirmService);

  public readonly request = input.required<RequestRow>();
  public readonly voted = output<VotePatch>();
  public readonly deleted = output<void>();

  protected readonly busy = signal(false);
  protected readonly deleting = signal(false);
  protected readonly pinning = signal(false);
  private readonly override = signal<VotePatch | null>(null);

  protected readonly display = computed<RequestRow>(() => {
    const request = this.request();
    const patch = this.override();
    return patch === null ? request : { ...request, ...patch };
  });

  protected readonly commentsEnabled = this.bootstrap.commentsEnabled;

  protected readonly canDelete = computed(() => this.request().isMine || this.bootstrap.isAdmin());
  protected readonly canPin = computed(() => this.bootstrap.isAdmin());

  protected readonly status = computed(
    () =>
      this.bootstrap.statusById(this.request().statusId) ?? {
        name: this.i18n.translate('board.unknownStatus'),
        color: '#78716c',
        isActive: false,
      },
  );

  protected readonly category = computed(
    () =>
      this.bootstrap.categoryById(this.request().categoryId) ?? {
        name: this.i18n.translate('board.unknownCategory'),
        color: '#78716c',
        isActive: false,
      },
  );

  protected readonly voteLabel = computed(() => {
    const request = this.display();
    const unit = this.i18n.translate(request.voteCount === 1 ? 'common.vote' : 'common.votes');
    const state = this.i18n.translate(request.viewerHasVoted ? 'requestCard.voted' : 'requestCard.notVoted');
    return `${request.voteCount} ${unit}. ${state}`;
  });

  protected readonly pinLabel = computed(() =>
    this.i18n.translate(this.request().isPinned ? 'requestDetail.unpinFromTop' : 'requestDetail.pinToTop'),
  );

  protected readonly commentsLabel = computed(() => {
    const count = this.request().commentCount;
    const unit = this.i18n.translate(count === 1 ? 'common.comment' : 'common.comments');
    return `${count} ${unit}`;
  });

  protected async onVote(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    await this.voteService.vote(this.display(), (patch) => {
      this.override.set(patch);
      this.voted.emit(patch);
    });
    this.busy.set(false);
  }

  protected async onPinToggle(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (this.pinning()) {
      return;
    }

    this.pinning.set(true);
    await this.board.setPinned(this.request().id, !this.request().isPinned);
    this.pinning.set(false);
  }

  protected async onDelete(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (this.deleting()) {
      return;
    }

    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('requestForm.deleteRequestTitle', { title: this.request().title }),
      message: this.i18n.translate('requestForm.deleteRequestMessage'),
      confirmLabel: this.i18n.translate('requestForm.deleteConfirm'),
      cancelLabel: this.i18n.translate('requestForm.deleteCancel'),
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    const error = await this.board.deleteRequest(this.request().id);
    this.deleting.set(false);

    if (error === null) {
      this.deleted.emit();
    }
  }
}
