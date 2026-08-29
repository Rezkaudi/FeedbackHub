import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from '../config/environment.token';

/**
 * Redis holds only state that must survive nothing (R-149): rate-limit
 * counters, idempotency keys, and the short-lived bootstrap cache.
 *
 * Losing Redis must degrade the app, never corrupt it. A lost counter means one
 * person gets one extra try, and that is acceptable. Nothing here is the only
 * copy of anything.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;

  public constructor(@Inject(APP_ENVIRONMENT) environment: AppEnvironmentToken) {
    this.client = new Redis(environment.redis.url, {
      // Fail fast rather than queueing forever: a slow Redis must not become a
      // slow request (R-104).
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    });

    // An unreachable Redis is a warning, not a crash. The readiness probe is
    // what tells the orchestrator to stop sending traffic (R-83).
    this.client.on('error', () => undefined);
  }

  public async isReachable(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  public onModuleDestroy(): void {
    this.client.disconnect();
  }
}
