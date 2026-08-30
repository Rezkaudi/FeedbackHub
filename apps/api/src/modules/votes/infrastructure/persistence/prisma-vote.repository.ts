import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { VoteRepository, VoteState } from '../../application/port/vote-repository';
import { withinRateLimit } from '../../../../shared/rate-limit/sliding-window';

/**
 * R-28: the number of votes is counted by the server from the real votes. There
 * is no count column, so it can never be wrong and the browser can never send
 * one.
 */
@Injectable()
export class PrismaVoteRepository implements VoteRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async stateFor(requestId: string, userId: string): Promise<VoteState> {
    const [voteCount, mine] = await Promise.all([
      this.prisma.vote.count({ where: { requestId } }),
      this.prisma.vote.findUnique({ where: { requestId_userId: { requestId, userId } } }),
    ]);

    return { voteCount, viewerHasVoted: mine !== null };
  }

  public async castVote(
    requestId: string,
    userId: string,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<VoteState> {
    return this.prisma.$transaction(async (tx) =>
      withinRateLimit(
        tx,
        { key: `vote:${userId}`, code: 'VOTE_RATE_LIMITED', policy: limit },
        now,
        (client, since) => countVotesBy(client, userId, since),
        async (client) => {
          /**
           * R-27: voting twice is fine and gives back the current state.
           *
           * createMany with skipDuplicates compiles to ON CONFLICT DO NOTHING,
           * so the unique index of R-26 still decides the outcome but the second
           * insert is a no-op rather than an error. Catching the violation
           * instead would not work: inside a transaction a failed statement
           * aborts the whole thing, and every later query in it fails too.
           */
          await client.vote.createMany({ data: [{ requestId, userId }], skipDuplicates: true });

          return countState(client, requestId, userId);
        },
      ),
    );
  }

  public async withdrawVote(
    requestId: string,
    userId: string,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<VoteState> {
    return this.prisma.$transaction(async (tx) =>
      withinRateLimit(
        tx,
        { key: `vote:${userId}`, code: 'VOTE_RATE_LIMITED', policy: limit },
        now,
        (client, since) => countVotesBy(client, userId, since),
        async (client) => {
          // deleteMany, not delete: removing nothing is fine (R-27).
          await client.vote.deleteMany({ where: { requestId, userId } });
          return countState(client, requestId, userId);
        },
      ),
    );
  }
}

/**
 * R-130: votes and un-votes are both writes and both counted, for one person.
 *
 * Un-voting deletes the row, so the votes table alone cannot count them — the
 * same gap the submission limit has (see SCOPE.md). What it does count is the
 * votes that currently exist in the window, which stops a hundred *new* votes
 * and leaves a vote/un-vote pair on the same request uncounted.
 */
async function countVotesBy(
  client: { $queryRaw: PrismaService['$queryRaw'] },
  userId: string,
  since: Date,
): Promise<{ count: number; oldest: Date | null }> {
  const rows = await client.$queryRaw<{ count: bigint; oldest: Date | null }[]>`
    SELECT count(*)::bigint AS count, min(created_at) AS oldest
    FROM votes
    WHERE user_id = ${userId}::uuid AND created_at >= ${since}
  `;

  return { count: Number(rows[0]?.count ?? 0), oldest: rows[0]?.oldest ?? null };
}

async function countState(
  tx: Prisma.TransactionClient,
  requestId: string,
  userId: string,
): Promise<VoteState> {
  const [voteCount, mine] = await Promise.all([
    tx.vote.count({ where: { requestId } }),
    tx.vote.findUnique({ where: { requestId_userId: { requestId, userId } } }),
  ]);

  return { voteCount, viewerHasVoted: mine !== null };
}
