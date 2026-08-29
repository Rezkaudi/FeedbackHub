import { Prisma } from '@prisma/client';
import { RateLimitedCode, RateLimitedError } from '../errors/app-error';

/**
 * The three rate limits of R-130, as one mechanism used three times (R-150).
 *
 * Three rules make this harder than a counter:
 *
 * R-131 — the window *slides*. It is not reset on the hour, and the refusal
 *         names the time the person may try again: one window after their
 *         **oldest** attempt inside the window, not one window from now.
 *         Resetting on the hour would let someone send ten at 13:59 and ten more
 *         at 14:00, and we could not name a time to come back.
 *
 * R-132 — the count and the write happen inside one database step, so two calls
 *         in the same second cannot both slip through. A count followed by an
 *         unprotected insert is a race, and at these limits it is an easy one to
 *         hit with a double click.
 *
 * R-130 — the rows already in the database *are* the counter. We count real
 *         requests, real votes, real users. That is what makes "a deleted
 *         request still counts while it is inside the window" true for free —
 *         except for requests, where deletion removes the row, so that one case
 *         is handled by the caller (see the note in its repository).
 *
 * Redis is deliberately not the counter here. A limit that is enforced in Redis
 * and a write that happens in Postgres cannot be one step, and R-149 says losing
 * Redis must never corrupt anything.
 *
 * How the single step is achieved: a transaction-scoped Postgres advisory lock,
 * keyed by what is being limited. Two calls for the same key queue behind each
 * other, so the second one counts a database that already contains the first
 * one's row. Calls with different keys never wait for each other, so one busy
 * person cannot slow anyone else down.
 */

export interface RateLimitPolicy {
  /** How many are allowed in the window. Always 1 or more (R-130). */
  readonly count: number;
  /** The length of the window, in minutes. Always 1 or more. */
  readonly minutes: number;
}

export interface RateLimitScope {
  /**
   * What is being limited. Two calls sharing a key are serialised; two calls
   * with different keys are not. Requests and votes are counted per person, so
   * the key includes the user id. New accounts are counted for the whole app,
   * because at that moment there is no person yet (R-130).
   */
  readonly key: string;
  readonly code: RateLimitedCode;
  readonly policy: RateLimitPolicy;
}

/** The transaction client. Only the two calls we actually need are required. */
export type TransactionClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

/**
 * Turns an arbitrary key into the pair of 32-bit integers Postgres wants for an
 * advisory lock. Collisions between different keys are possible and harmless:
 * the worst case is two unrelated callers briefly queueing behind each other.
 */
function lockPair(key: string): [number, number] {
  let a = 0x811c9dc5;
  let b = 0x01000193;

  for (let i = 0; i < key.length; i += 1) {
    a = Math.imul(a ^ key.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ key.charCodeAt(key.length - 1 - i), 0x85ebca6b);
  }

  return [a | 0, b | 0];
}

export interface AttemptCounter {
  /**
   * How many attempts this key has made at or after `since`, and when the
   * oldest of them was. Runs on the same transaction client, so it sees rows
   * written by calls that already hold the lock.
   */
  (tx: TransactionClient, since: Date): Promise<{ count: number; oldest: Date | null }>;
}

/**
 * Takes the lock, counts, and either refuses or runs the write — all inside the
 * caller's transaction, which is what makes it one step (R-132).
 *
 * The caller owns the transaction because the write it protects is the caller's:
 * inserting a vote, a request or a user. Passing the transaction in is what
 * stops this becoming "count here, write over there".
 */
export async function withinRateLimit<T>(
  tx: TransactionClient,
  scope: RateLimitScope,
  now: Date,
  countAttempts: AttemptCounter,
  write: () => Promise<T>,
): Promise<T> {
  const [a, b] = lockPair(scope.key);

  // Held until this transaction commits or rolls back. There is no unlock to
  // forget, and a crashed connection releases it.
  // $executeRaw, not $queryRaw: the function returns void, which has no row to
  // deserialize.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${a}::int, ${b}::int)`;

  const since = new Date(now.getTime() - scope.policy.minutes * 60_000);
  const { count, oldest } = await countAttempts(tx, since);

  if (count >= scope.policy.count) {
    // R-131: one window after their oldest attempt, not one window from now.
    // If they waited 20 minutes of a 60-minute window, they are told 40 minutes,
    // not 60. `oldest` is only null if the count came back zero, which cannot
    // reach here, but the fallback keeps the type honest.
    const retryAt =
      oldest === null
        ? new Date(now.getTime() + scope.policy.minutes * 60_000)
        : new Date(oldest.getTime() + scope.policy.minutes * 60_000);

    throw new RateLimitedError(scope.code, retryAt);
  }

  return write();
}
