import { Inject, Injectable } from '@nestjs/common';
import { VOTE_REPOSITORY, VoteRepository, VoteState } from '../port/vote-repository';
import { RequestsService } from '../../../requests/requests.service';
import { SettingsService } from '../../../settings/settings.service';
import { CLOCK, type Clock } from '../../../../shared/ports';
import { NotFoundError } from '../../../../shared/errors/app-error';

/** R-26, R-27: taking a vote back, and taking back one that is not there. */
@Injectable()
export class WithdrawVote {
  public constructor(
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    private readonly requests: RequestsService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async execute(requestId: string, userId: string): Promise<VoteState> {
    if ((await this.requests.summaryOf(requestId)) === null) {
      throw new NotFoundError('Feedback request', requestId);
    }

    const { voteLimit } = await this.settings.appSettings();
    return this.votes.withdrawVote(requestId, userId, voteLimit, this.clock.now());
  }
}
