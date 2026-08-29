import { Inject, Injectable } from '@nestjs/common';
import { VOTE_REPOSITORY, VoteRepository, VoteState } from '../port/vote-repository';
import { RequestsService } from '../../../requests/requests.service';
import { SettingsService } from '../../../settings/settings.service';
import { CLOCK, type Clock } from '../../../../shared/ports';
import { NotFoundError } from '../../../../shared/errors/app-error';

/**
 * R-26, R-27, R-29: one person, one vote per request, and they may vote for
 * their own. A new request starts at zero votes, not one.
 *
 * Voting twice gives back the current state rather than an error (R-27), so the
 * screen never has to explain a race the person did not cause.
 */
@Injectable()
export class CastVote {
  public constructor(
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    private readonly requests: RequestsService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async execute(requestId: string, userId: string): Promise<VoteState> {
    // SRS 15.4: the request was deleted a second ago -> a clear message, not a
    // foreign-key error.
    if ((await this.requests.summaryOf(requestId)) === null) {
      throw new NotFoundError('Feedback request', requestId);
    }

    const { voteLimit } = await this.settings.appSettings();
    return this.votes.castVote(requestId, userId, voteLimit, this.clock.now());
  }
}
