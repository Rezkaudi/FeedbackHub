import { CastVote } from '../../application/use-case/cast-vote';
import { WithdrawVote } from '../../application/use-case/withdraw-vote';
import { VoteRepository, VoteState } from '../../application/port/vote-repository';
import { NotFoundError } from '../../../../shared/errors/app-error';
import { FixedClock } from '../../../../shared/ports';

/**
 * The votes module had no tests at all. These are not test-first: the code was
 * already written, so they prove what is there rather than drive it. Where a
 * rule cannot be proved here it says so, and names the layer that must prove it.
 *
 * What this file can prove: that a use case refuses a request that is gone
 * (SRS 15.4), that it reads the limit from settings rather than a constant so
 * R-69 holds with no restart, that time arrives through the clock port (R-152),
 * and that a person may vote for their own request (R-29).
 *
 * What it cannot prove, and must not pretend to: R-26 itself. "One person, one
 * vote" is kept by a unique index on (request_id, user_id), and a fake
 * repository that returns whatever it is told proves nothing about a database
 * constraint. Ten simultaneous clicks are an integration test against a real
 * Postgres, and that test does not exist yet.
 */

interface Call {
  readonly requestId: string;
  readonly userId: string;
  readonly limit: { count: number; minutes: number };
  readonly now: Date;
}

class FakeVoteRepository implements VoteRepository {
  public readonly cast: Call[] = [];
  public readonly withdrawn: Call[] = [];

  public constructor(private readonly state: VoteState) {}

  public castVote(
    requestId: string,
    userId: string,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<VoteState> {
    this.cast.push({ requestId, userId, limit, now });
    return Promise.resolve(this.state);
  }

  public withdrawVote(
    requestId: string,
    userId: string,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<VoteState> {
    this.withdrawn.push({ requestId, userId, limit, now });
    return Promise.resolve(this.state);
  }

  public stateFor(): Promise<VoteState> {
    return Promise.resolve(this.state);
  }
}

const REQUEST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VOTER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = new Date('2026-08-30T13:00:00.000Z');

/** Only the two methods the use cases actually call. */
function requestsThatKnow(authorId: string | null): { summaryOf: jest.Mock } {
  return {
    summaryOf: jest.fn().mockResolvedValue(
      authorId === null ? null : { id: REQUEST, title: 'Dark mode', authorId },
    ),
  };
}

function settingsWith(count: number, minutes: number): { appSettings: jest.Mock } {
  return {
    appSettings: jest.fn().mockResolvedValue({ voteLimit: { count, minutes } }),
  };
}

function castVoteWith(
  repository: VoteRepository,
  requests: { summaryOf: jest.Mock },
  settings: { appSettings: jest.Mock },
): CastVote {
  return new CastVote(
    repository,
    requests as never,
    settings as never,
    new FixedClock(NOW),
  );
}

function withdrawVoteWith(
  repository: VoteRepository,
  requests: { summaryOf: jest.Mock },
  settings: { appSettings: jest.Mock },
): WithdrawVote {
  return new WithdrawVote(
    repository,
    requests as never,
    settings as never,
    new FixedClock(NOW),
  );
}

describe('casting a vote', () => {
  it('gives back the count and whether I have voted', async () => {
    const repository = new FakeVoteRepository({ voteCount: 4, viewerHasVoted: true });

    const state = await castVoteWith(
      repository,
      requestsThatKnow('someone-else'),
      settingsWith(100, 60),
    ).execute(REQUEST, VOTER);

    expect(state).toEqual({ voteCount: 4, viewerHasVoted: true });
  });

  it('lets a person vote for their own request (R-29)', async () => {
    const repository = new FakeVoteRepository({ voteCount: 1, viewerHasVoted: true });

    await castVoteWith(repository, requestsThatKnow(VOTER), settingsWith(100, 60)).execute(
      REQUEST,
      VOTER,
    );

    expect(repository.cast).toHaveLength(1);
  });

  /**
   * SRS 15.4: "the request was deleted a second ago -> a clear message and the
   * person is sent back to the board". A foreign-key error would surface as a
   * 500 and tell them nothing.
   */
  it('refuses a request that is gone, and writes nothing', async () => {
    const repository = new FakeVoteRepository({ voteCount: 0, viewerHasVoted: false });
    const castVote = castVoteWith(repository, requestsThatKnow(null), settingsWith(100, 60));

    await expect(castVote.execute(REQUEST, VOTER)).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.cast).toHaveLength(0);
  });

  /**
   * R-69: an admin changes the limit while the app runs, with no restart. That
   * only holds if the limit is read per call rather than captured once.
   */
  it('reads the limit from settings on every call, not from a constant', async () => {
    const repository = new FakeVoteRepository({ voteCount: 1, viewerHasVoted: true });
    const settings = settingsWith(7, 15);

    await castVoteWith(repository, requestsThatKnow('other'), settings).execute(REQUEST, VOTER);

    expect(settings.appSettings).toHaveBeenCalledTimes(1);
    expect(repository.cast[0]?.limit).toEqual({ count: 7, minutes: 15 });
  });

  /** R-152: time is a port, so the sliding window is testable with no sleeping. */
  it('passes the clock through rather than reading the wall clock', async () => {
    const repository = new FakeVoteRepository({ voteCount: 1, viewerHasVoted: true });

    await castVoteWith(repository, requestsThatKnow('other'), settingsWith(100, 60)).execute(
      REQUEST,
      VOTER,
    );

    expect(repository.cast[0]?.now).toEqual(NOW);
  });

  it('votes as the person asking, never as an id from the request body (R-7)', async () => {
    const repository = new FakeVoteRepository({ voteCount: 1, viewerHasVoted: true });

    await castVoteWith(repository, requestsThatKnow('other'), settingsWith(100, 60)).execute(
      REQUEST,
      VOTER,
    );

    expect(repository.cast[0]?.userId).toBe(VOTER);
    expect(repository.cast[0]?.requestId).toBe(REQUEST);
  });
});

describe('taking a vote back', () => {
  it('gives back the count and that I no longer have a vote', async () => {
    const repository = new FakeVoteRepository({ voteCount: 3, viewerHasVoted: false });

    const state = await withdrawVoteWith(
      repository,
      requestsThatKnow('other'),
      settingsWith(100, 60),
    ).execute(REQUEST, VOTER);

    expect(state).toEqual({ voteCount: 3, viewerHasVoted: false });
  });

  /**
   * R-27: un-voting when there is no vote is fine — it gives back the current
   * state instead of an error, so a double click never produces a message the
   * person has to understand.
   */
  it('is not an error when there was no vote to take back', async () => {
    const repository = new FakeVoteRepository({ voteCount: 0, viewerHasVoted: false });

    const state = await withdrawVoteWith(
      repository,
      requestsThatKnow('other'),
      settingsWith(100, 60),
    ).execute(REQUEST, VOTER);

    expect(state).toEqual({ voteCount: 0, viewerHasVoted: false });
    expect(repository.withdrawn).toHaveLength(1);
  });

  it('refuses a request that is gone, and writes nothing', async () => {
    const repository = new FakeVoteRepository({ voteCount: 0, viewerHasVoted: false });
    const withdraw = withdrawVoteWith(repository, requestsThatKnow(null), settingsWith(100, 60));

    await expect(withdraw.execute(REQUEST, VOTER)).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.withdrawn).toHaveLength(0);
  });

  /**
   * R-130 counts a vote and an un-vote alike: both are writes, and the one-vote
   * rule stops a second vote, not a hundred vote/un-vote pairs.
   */
  it('is rate limited too, with the same limit as voting', async () => {
    const repository = new FakeVoteRepository({ voteCount: 0, viewerHasVoted: false });

    await withdrawVoteWith(repository, requestsThatKnow('other'), settingsWith(7, 15)).execute(
      REQUEST,
      VOTER,
    );

    expect(repository.withdrawn[0]?.limit).toEqual({ count: 7, minutes: 15 });
  });
});
