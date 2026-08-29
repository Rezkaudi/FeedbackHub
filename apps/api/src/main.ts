// Loads apps/api/.env into process.env before anything reads it. A value
// already in the real environment always wins, so a container — which sets its
// own and has no .env file — behaves exactly as before. This exists so that
// running the API outside a container needs one file instead of a dozen
// exports; it never replaces the environment, and no secret has a default
// (R-102).
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, configureDocs } from './bootstrap-app';
import { loadEnvironment } from './shared/config/environment';
import { json, urlencoded } from 'express';

/**
 * The API process. The worker runs from the same image with a different
 * command (R-144) — see worker.ts.
 */
async function bootstrap(): Promise<void> {
  // Read and check the environment before anything else starts. A bad
  // environment must stop the boot, not surface at the first request (R-102).
  const environment = loadEnvironment();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // R-96: at most 1 MB per request, from the environment.
  app.use(json({ limit: environment.requestBodyLimit }));
  app.use(urlencoded({ extended: false, limit: environment.requestBodyLimit }));

  configureApp(app, environment);
  configureDocs(app);

  await app.listen(environment.port);
}

void bootstrap();
