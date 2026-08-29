import { PrismaClient } from '@prisma/client';
import { startTestDatabase, TestDatabase } from './database';
import { withinRateLimit } from '../../src/shared/rate-limit/sliding-window';
import { RateLimitedError } from '../../src/shared/errors/app-error';

/**
 * R-132 says two calls in the same second cannot both slip through. That is a
 * claim about concurrency, so it is worthless asserted against a mock: this file
 * runs real overlapping transactions against a real Postgres.
 *
 * R-131 says the refusal names one window after the person's *oldest* attempt.
 * The clock is passed in, so that is checked exactly rather than approximately.
 */
describe('the sliding window, against a real database', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;

  beforeAll(async () => {
    db = await startTestDatabase();
    prisma = db.prisma;
  }, 240000);

  afterAll(async () => {
    await db?.stop();
  });

  beforeEach(async () => {
    await db.truncate();
  });

  const now = new Date('2026-08-29T13:40:00.000Z');

  /** Counts users, exactly as the sign-up limit does (R-130, whole app). */
  const countUsers = async (
    tx: { $queryRaw: PrismaClient['$queryRaw'] },
    since: Date,
  ): Promise<{ count: number; oldest: Date | null }> => {
    const rows = await tx.$queryRaw<{ count: bigint; oldest: Date | null }[]>`
      SELECT count(*)::bigint AS count, min(created_at) AS oldest
      FROM users WHERE created_at >= ${since}
    `;
    return { count: Number(rows[0]?.count ?? 0), oldest: rows[0]?.oldest ?? null };
  };

  const scope = { key: 'signup', code: 'SIGNUP_RATE_LIMITED' as const, policy: { count: 3, minutes: 60 } };

  const addUser = (createdAt: Date, suffix: string) =>
    prisma.user.create({
      data: {
        externalId: `ext-${suffix}`,
        email: `person-${suffix}@example.com`,
        displayName: 'A Person',
        createdAt,
      },
    });

  const attemptSignup = (suffix: string, at: Date = now) =>
    prisma.$transaction((tx) =>
      withinRateLimit(tx, scope, at, countUsers, () => addUser(at, suffix)),
    );

  it('allows attempts up to the limit', async () => {
    await attemptSignup('a');
    await attemptSignup('b');
    await attemptSignup('c');

    await expect(prisma.user.count()).resolves.toBe(3);
  });

  it('refuses the one past the limit, and saves nothing', async () => {
    await attemptSignup('a');
    await attemptSignup('b');
    await attemptSignup('c');

    await expect(attemptSignup('d')).rejects.toBeInstanceOf(RateLimitedError);
    await expect(prisma.user.count()).resolves.toBe(3);
  });

  describe('two calls in the same moment (R-132)', () => {
    it('lets exactly the allowed number through when ten are fired at once', async () => {
      const attempts = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) => attemptSignup(`race-${i}`)),
      );

      const allowed = attempts.filter((a) => a.status === 'fulfilled');
      const refused = attempts.filter(
        (a) => a.status === 'rejected' && a.reason instanceof RateLimitedError,
      );

      expect(allowed).toHaveLength(3);
      expect(refused).toHaveLength(7);
      // The database is the proof: not one row more than the limit.
      await expect(prisma.user.count()).resolves.toBe(3);
    });

    it('does not make callers with different keys wait for each other', async () => {
      const perPerson = (userId: string) => ({
        key: `vote:${userId}`,
        code: 'VOTE_RATE_LIMITED' as const,
        policy: { count: 1, minutes: 60 },
      });

      const [first, second] = await Promise.all([
        prisma.$transaction((tx) =>
          withinRateLimit(tx, perPerson('one'), now, async () => ({ count: 0, oldest: null }), () =>
            addUser(now, 'one'),
          ),
        ),
        prisma.$transaction((tx) =>
          withinRateLimit(tx, perPerson('two'), now, async () => ({ count: 0, oldest: null }), () =>
            addUser(now, 'two'),
          ),
        ),
      ]);

      expect(first.id).not.toBe(second.id);
    });
  });

  describe('the window slides (R-131)', () => {
    it('says the person may try again one window after their OLDEST attempt', async () => {
      // Three sign-ups: 13:00, 13:20, 13:30. The limit is 3 in 60 minutes.
      await addUser(new Date('2026-08-29T13:00:00.000Z'), 'a');
      await addUser(new Date('2026-08-29T13:20:00.000Z'), 'b');
      await addUser(new Date('2026-08-29T13:30:00.000Z'), 'c');

      // They try at 13:40. They have waited 40 minutes of the window already,
      // so the answer is 14:00 — not 14:40.
      const failure = attemptSignup('d', now);

      await expect(failure).rejects.toMatchObject({
        retryAt: new Date('2026-08-29T14:00:00.000Z'),
      });
    });

    it('lets them through once the oldest attempt falls out of the window', async () => {
      await addUser(new Date('2026-08-29T13:00:00.000Z'), 'a');
      await addUser(new Date('2026-08-29T13:20:00.000Z'), 'b');
      await addUser(new Date('2026-08-29T13:30:00.000Z'), 'c');

      // At 14:01 the 13:00 one is too old to count, so there is room again.
      await expect(attemptSignup('d', new Date('2026-08-29T14:01:00.000Z'))).resolves.toBeDefined();
      await expect(prisma.user.count()).resolves.toBe(4);
    });

    it('is not reset on the hour: ten at 13:59 and ten at 14:00 is still refused', async () => {
      await addUser(new Date('2026-08-29T13:59:00.000Z'), 'a');
      await addUser(new Date('2026-08-29T13:59:30.000Z'), 'b');
      await addUser(new Date('2026-08-29T13:59:59.000Z'), 'c');

      await expect(
        attemptSignup('d', new Date('2026-08-29T14:00:00.000Z')),
      ).rejects.toBeInstanceOf(RateLimitedError);
    });
  });

  it('reads the limit from what it is given, so an admin can raise it with no restart (R-69)', async () => {
    await attemptSignup('a');
    await attemptSignup('b');
    await attemptSignup('c');
    await expect(attemptSignup('d')).rejects.toBeInstanceOf(RateLimitedError);

    const raised = { ...scope, policy: { count: 5, minutes: 60 } };
    await expect(
      prisma.$transaction((tx) =>
        withinRateLimit(tx, raised, now, countUsers, () => addUser(now, 'e')),
      ),
    ).resolves.toBeDefined();
  });
});
