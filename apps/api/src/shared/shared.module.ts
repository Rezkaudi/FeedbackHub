import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaService } from './database/prisma.service';
import { RedisService } from './redis/redis.service';
import { HealthController } from './health/health.controller';
import { AppExceptionFilter, ErrorLogger } from './errors/app-exception.filter';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from './config/environment.token';
import { loadEnvironment } from './config/environment';
import { CLOCK, ID_GENERATOR, SystemClock, UuidGenerator } from './ports';
import { Logger } from './logging/logger';

/**
 * The shared kernel: the parts every module reuses, wired once (R-150).
 *
 * The guard chain is *not* registered here. Its first link needs to know who is
 * signed in, and that implementation belongs to `identity` — a module. The
 * shared kernel never depends on a module (R-141), so the guards are composed in
 * AppModule, which is allowed to know about both.
 *
 * @Global because every module needs the database, the clock and the error
 * shape; making each one import SharedModule would be ceremony, not a seam.
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: APP_ENVIRONMENT,
      useFactory: (): AppEnvironmentToken => loadEnvironment(),
    },
    PrismaService,
    RedisService,
    Logger,
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },

    // Every error leaves through one filter, so R-76 and R-100 hold everywhere.
    {
      provide: APP_FILTER,
      useFactory: (logger: ErrorLogger): AppExceptionFilter => new AppExceptionFilter(logger),
      inject: [Logger],
    },
  ],
  exports: [APP_ENVIRONMENT, PrismaService, RedisService, Logger, CLOCK, ID_GENERATOR],
})
export class SharedModule {}
