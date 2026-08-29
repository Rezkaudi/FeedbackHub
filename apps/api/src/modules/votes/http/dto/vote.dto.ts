import { ApiProperty } from '@nestjs/swagger';
import { VoteState } from '../../application/port/vote-repository';

/**
 * R-28: the count always comes from the server. There is deliberately no DTO
 * for *sending* a vote count — the browser has nothing to send.
 */
export class VoteStateResponse {
  @ApiProperty({ description: 'Counted from the real votes (R-28).' })
  public readonly voteCount!: number;

  @ApiProperty({ description: 'Whether the person asking has voted.' })
  public readonly viewerHasVoted!: boolean;

  public static from(state: VoteState): VoteStateResponse {
    return { voteCount: state.voteCount, viewerHasVoted: state.viewerHasVoted };
  }
}
