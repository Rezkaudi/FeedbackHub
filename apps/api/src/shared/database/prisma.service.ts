import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The one Prisma client for the process.
 *
 * It is deliberately the only thing in the app that knows Prisma exists outside
 * a module's `infrastructure/` folder. Use cases never see it (R-147), and the
 * dependency check fails a build that hands it to `application` or `domain`.
 *
 * Pooling is left to Prisma's own pool, sized from the connection string
 * (`?connection_limit=`), so it is tuned per deployment rather than in code.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  public constructor() {
    super({
      // Never `query` in production: a query log carries the values people
      // typed, which is personal data in a log (R-119).
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Part of graceful shutdown: finish in-flight work, then let go of the pool. */
  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
