import { RateLimitScope, TransactionClient, withinRateLimit } from './sliding-window';

describe('withinRateLimit', () => {
  const now = new Date('2026-08-29T13:40:00.000Z');
  const scope: RateLimitScope = {
    key: 'signup:all',
    code: 'SIGNUP_RATE_LIMITED',
    policy: { count: 1, minutes: 60 },
  };

  it('runs the protected write with the transaction client that owns the lock', async () => {
    const tx = {
      $executeRaw: () => Promise.resolve(0),
      $queryRaw: () => Promise.resolve([]),
    } as unknown as TransactionClient;

    let countedWith: unknown;
    let wroteWith: unknown;

    await expect(
      withinRateLimit(
        tx,
        scope,
        now,
        (client) => {
          countedWith = client;
          return Promise.resolve({ count: 0, oldest: null });
        },
        (client) => {
          wroteWith = client;
          return Promise.resolve('written');
        },
      ),
    ).resolves.toBe('written');

    expect(countedWith).toBe(tx);
    expect(wroteWith).toBe(tx);
  });
});
