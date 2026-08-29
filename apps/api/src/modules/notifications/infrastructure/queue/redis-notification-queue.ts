import { Injectable } from '@nestjs/common';
import { NotificationQueue } from '../../application/port/notification-ports';
import { NotificationJob } from '../../domain/entity/notification-job';
import { RedisService } from '../../../../shared/redis/redis.service';
import { Logger } from '../../../../shared/logging/logger';

/**
 * A Redis list used as a queue (R-149). Deliberately the simplest thing that
 * meets the SRS: R-127 says a failed email is logged and dropped, with no retry
 * and no record, so a full job framework with retries and dead letters would be
 * machinery for guarantees we have decided not to make.
 *
 * Losing Redis loses queued emails and nothing else — never a comment, never a
 * status change (R-149, R-72).
 */
const QUEUE_KEY = 'feedbackhub:notifications';

@Injectable()
export class RedisNotificationQueue implements NotificationQueue {
  public constructor(
    private readonly redis: RedisService,
    private readonly logger: Logger,
  ) {}

  public async enqueue(job: NotificationJob): Promise<void> {
    // Never throws: the caller is in the middle of finishing someone's comment.
    try {
      await this.redis.client.lpush(QUEUE_KEY, JSON.stringify(job));
    } catch (error) {
      this.logger.error({ err: error, kind: job.kind }, 'Could not queue an email; it was dropped');
    }
  }

  /** The worker's end. Blocks briefly so it does not spin on an empty queue. */
  public async dequeue(timeoutSeconds: number): Promise<NotificationJob | null> {
    const result = await this.redis.client.brpop(QUEUE_KEY, timeoutSeconds);

    if (result === null) {
      return null;
    }

    const [, payload] = result;

    try {
      return JSON.parse(payload) as NotificationJob;
    } catch (error) {
      // A job we cannot read is dropped rather than retried for ever.
      this.logger.error({ err: error }, 'Could not read a queued email; it was dropped');
      return null;
    }
  }
}
