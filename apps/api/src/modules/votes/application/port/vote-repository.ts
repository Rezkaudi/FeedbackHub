export interface VoteState {
  readonly voteCount: number;
  readonly viewerHasVoted: boolean;
}

export interface VoteRepository {
  /**
   * R-26 + R-27 + R-130 + R-132 in one database step.
   *
   * Idempotent on purpose: voting twice gives back the current state instead of
   * an error, so a double click can never make two votes *or* an error message
   * the person has to understand. The unique index is what makes that safe —
   * the second insert is refused by the database, not by a check that could
   * lose a race (R-115).
   */
  castVote(
    requestId: string,
    userId: string,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<VoteState>;

  /** Un-voting when there is no vote is fine, and gives back the state (R-27). */
  withdrawVote(
    requestId: string,
    userId: string,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<VoteState>;

  stateFor(requestId: string, userId: string): Promise<VoteState>;
}

export const VOTE_REPOSITORY = Symbol('VoteRepository');
