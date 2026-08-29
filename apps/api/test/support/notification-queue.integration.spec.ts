import { RedisNotificationQueue } from '../../src/modules/notifications/infrastructure/queue/redis-notification-queue';
import { RedisService } from '../../src/shared/redis/redis.service';
import { Logger } from '../../src/shared/logging/logger';
import { NotificationJob } from '../../src/modules/notifications/domain/entity/notification-job';
import { AppEnvironmentToken } from '../../src/shared/config/environment.token';
import { TestDatabase, startTestDatabase } from './database';

/**
 * The queue is the seam between the API process and the worker (R-144), so a
 * job has to survive being written by one and read by the other. A fake Redis
 * would prove nothing about that: it is the serialising and the blocking pop
 * that could be wrong.
 *
 * The two failure promises are the point of this file. R-72: enqueue must never
 * throw, because the caller is finishing someone's comment. R-127: a job that
 * cannot be read is dropped, not retried for ever.
 */
describe('the notification queue, against a real Redis', () => {
  let database: TestDatabase;
  let redis: RedisService;
  let queue: RedisNotificationQueue;

  const silentLogger = {
    debug: (): void => undefined,
    info: (): void => undefined,
    warn: (): void => undefined,
    error: (): void => undefined,
  } as unknown as Logger;

  const environmentFor = (url: string): AppEnvironmentToken =>
    ({ redis: { url }, logLevel: 'silent' }) as unknown as AppEnvironmentToken;

  beforeAll(async () => {
    database = await startTestDatabase();
    redis = new RedisService(environmentFor(database.redisUrl));
    queue = new RedisNotificationQueue(redis, silentLogger);

    // The client refuses commands before it is connected (`enableOfflineQueue:
    // false`, so a slow Redis never becomes a slow request). In the app that
    // connection is made while Nest is starting; here we wait for it ourselves.
    if (redis.client.status !== 'ready') {
      await new Promise<void>((resolve) => redis.client.once('ready', () => resolve()));
    }
  }, 240000);

  afterAll(async () => {
    redis?.onModuleDestroy();
    await database?.stop();
  });

  beforeEach(async () => {
    await redis.client.del('feedbackhub:notifications');
  });

  const aJob: NotificationJob = {
    kind: 'comment_on_my_request',
    requestId: '00000000-0000-4000-8000-0000000000c3',
    requestTitle: 'Dark mode',
    recipientId: '00000000-0000-4000-8000-0000000000a1',
    commenterName: 'Sam',
  };

  it('carries a job from the API process to the worker unchanged', async () => {
    await queue.enqueue(aJob);

    await expect(queue.dequeue(1)).resolves.toEqual(aJob);
  });

  it('hands out the oldest job first, so nobody waits behind a newer one', async () => {
    await queue.enqueue(aJob);
    await queue.enqueue({ ...aJob, requestTitle: 'Second' });

    await expect(queue.dequeue(1)).resolves.toMatchObject({ requestTitle: 'Dark mode' });
    await expect(queue.dequeue(1)).resolves.toMatchObject({ requestTitle: 'Second' });
  });

  it('gives one job to exactly one worker', async () => {
    await queue.enqueue(aJob);

    const [first, second] = await Promise.all([queue.dequeue(1), queue.dequeue(1)]);

    expect([first, second].filter((job) => job !== null)).toHaveLength(1);
  });

  it('returns nothing rather than spinning when the queue is empty', async () => {
    await expect(queue.dequeue(1)).resolves.toBeNull();
  });

  /** R-127: a job we cannot read is dropped, never retried for ever. */
  it('drops a job it cannot read, instead of blocking the queue behind it', async () => {
    await redis.client.lpush('feedbackhub:notifications', 'this is not json');
    await queue.enqueue(aJob);

    // The unreadable one is popped first and dropped; the good one still arrives.
    await expect(queue.dequeue(1)).resolves.toBeNull();
    await expect(queue.dequeue(1)).resolves.toEqual(aJob);
  });

  /**
   * R-72 and R-149: losing Redis loses queued emails and nothing else. The
   * caller is in the middle of saving a comment, so this must not throw.
   */
  it('does not throw when Redis is unreachable', async () => {
    const unreachable = new RedisService(environmentFor('redis://127.0.0.1:1'));
    const brokenQueue = new RedisNotificationQueue(unreachable, silentLogger);

    await expect(brokenQueue.enqueue(aJob)).resolves.toBeUndefined();

    unreachable.onModuleDestroy();
  });
});
