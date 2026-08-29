import { Controller, Delete, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/http/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { VoteStateResponse } from './dto/vote.dto';
import { CastVote } from '../application/use-case/cast-vote';
import { WithdrawVote } from '../application/use-case/withdraw-vote';

/**
 * Voting is one click, so it is one call with no body at all — there is nothing
 * for a browser to send and therefore nothing to tamper with (R-28).
 */
@ApiTags('votes')
@ApiUnauthorizedResponse({ description: 'Not signed in (R-6).' })
@Controller('requests/:id/vote')
export class VotesController {
  public constructor(
    private readonly castVote: CastVote,
    private readonly withdrawVote: WithdrawVote,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Vote for this request (R-26).',
    description: 'Voting twice is fine: it gives back the current state, never an error (R-27).',
  })
  @ApiOkResponse({ type: VoteStateResponse })
  @ApiNotFoundResponse({ description: 'The request was deleted (SRS 15.4).' })
  @ApiTooManyRequestsResponse({ description: 'Over the vote limit; says when to try again.' })
  public async vote(
    @Param('id', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VoteStateResponse> {
    return VoteStateResponse.from(await this.castVote.execute(requestId, user.id));
  }

  @Delete()
  @ApiOperation({
    summary: 'Take my vote back (R-26).',
    description: 'Un-voting when there is no vote is fine, and gives back the state (R-27).',
  })
  @ApiOkResponse({ type: VoteStateResponse })
  public async unvote(
    @Param('id', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VoteStateResponse> {
    return VoteStateResponse.from(await this.withdrawVote.execute(requestId, user.id));
  }
}
