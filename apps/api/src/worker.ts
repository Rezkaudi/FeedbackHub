// Same reason as main.ts: one file instead of a dozen exports when this runs
// outside a container. A real environment variable always wins.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DeliverNotification } from './modules/notifications/application/use-case/deliver-notification';
import { NOTIFICATION_QUEUE } from './modules/notifications/application/port/notification-ports';
import type { NotificationQueue } from './modules/notifications/application/port/notification-ports';
import { Logger } from './shared/logging/logger';
import { loadEnvironment } from './shared/config/environment';

/**
 * The email worker (R-144): the **same container image** as the API, with a
 * different command. It shares the code and the database, and serves no HTTP.
 *
 * It is the one thing split off from the monolith, because sending email must
 * never slow down or break what the person just asked for (R-72, R-116), and it
 * owns no shared invariant — which is also why it would be the first module to
 * become its own service if the app ever grew (SRS 8.4).
 */
const IDLE_WAIT_SECONDS = 5;

async function bootstrap(): Promise<void> {
  loadEnvironment();

  // createApplicationContext, not create: no HTTP server is started at all.
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });

  const queue = app.get<NotificationQueue>(NOTIFICATION_QUEUE);
  const deliver = app.get(DeliverNotification);
  const logger = app.get(Logger);

  let running = true;

  // Graceful shutdown: finish the job in hand, then stop. A job that was taken
  // off the queue and not yet sent is lost, which R-127 already accepts — a
  // failed email is logged and dropped, with no retry.
  const stop = (signal: string): void => {
    logger.info({ signal }, 'Worker is stopping');
    running = false;
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));

  logger.info({}, 'Worker started');

  while (running) {
    try {
      const job = await queue.dequeue(IDLE_WAIT_SECONDS);

      if (job !== null) {
        await deliver.execute(job);
      }
    } catch (error) {
      // A broken Redis must not kill the worker: it waits and tries again.
      logger.error({ err: error }, 'The worker could not read the queue');
      await new Promise((resolve) => setTimeout(resolve, IDLE_WAIT_SECONDS * 1000));
    }
  }

  await app.close();
}

void bootstrap();
