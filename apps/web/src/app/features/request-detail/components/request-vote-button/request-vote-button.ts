import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nStore } from '../../../../core/i18n/i18n.store';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Spinner } from '../../../../shared/ui/spinner/spinner';

@Component({
  selector: 'fh-request-vote-button',
  imports: [Icon, Spinner],
  templateUrl: './request-vote-button.html',
  styleUrl: './request-vote-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestVoteButton {
  private readonly i18n = inject(I18nStore);

  public readonly voteCount = input.required<number>();
  public readonly hasVoted = input.required<boolean>();
  public readonly busy = input<boolean>(false);

  public readonly voted = output<void>();

  protected readonly verb = computed(() =>
    this.i18n.translate(this.hasVoted() ? 'requestDetail.voted' : 'requestDetail.upvote'),
  );

  protected readonly label = computed(() => {
    const count = this.voteCount();
    const unit = this.i18n.translate(count === 1 ? 'common.vote' : 'common.votes');
    const state = this.i18n.translate(this.hasVoted() ? 'requestDetail.voteTakeBack' : 'requestDetail.voteCast');
    return `${count} ${unit}. ${state}`;
  });
}
