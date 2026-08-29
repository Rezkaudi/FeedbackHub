import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppEnvironment } from './shared/config/environment';
import { attachRequestId } from './shared/logging/request-id';
import { ValidationFailedError } from './shared/errors/app-error';

/**
 * Everything that must be true of the HTTP surface, applied once (R-150).
 * Shared by `main.ts` and by the API tests, so a test exercises the same stack a
 * request meets in production — a guard the tests could skip is a guard that is
 * not really there.
 */
export function configureApp(app: INestApplication, environment: AppEnvironment): void {
  // R-119, R-100: one id per call, echoed in every error.
  app.use((request: Request, _response: Response, next: NextFunction) => {
    attachRequestId(request as unknown as Record<string, unknown>);
    next();
  });

  // R-101: the normal safety headers.
  app.use(
    helmet({
      // The API serves JSON everywhere but /api/docs (R-78), which is a real
      // page that fetches this same origin. Helmet ships no connect-src of its
      // own, so connect-src inherits default-src: with 'none' and nothing else,
      // the browser blocks every call the docs page tries to make.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(compression());
  app.use(cookieParser());

  // R-101, R-3g: only our own web addresses may call the API, and they must be
  // allowed to send the auth cookies.
  app.enableCors({
    origin: [...environment.auth.allowedOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });

  // R-75: one web API with a version in the address. The prefix is the version;
  // Nest's own versioning layer would be a second way to do the same job (R-150).
  // The health checks sit outside it: a probe should not have to know the version.
  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready'] });

  /**
   * R-95: everything sent to the server is checked against a written shape, and
   * unknown fields are refused rather than ignored.
   *
   * `forbidNonWhitelisted` is what closes mass assignment: a body carrying
   * `status` or `voteCount` or `role` is rejected outright instead of being
   * quietly dropped, which is the behaviour SRS part 17 asks for by name.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );

  // R-79/R-83: finish in-flight work before the process goes away.
  app.enableShutdownHooks();
}

/** R-78: an API document generated from the code, so /api/docs cannot drift. */
export function configureDocs(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('FeedbackHub API')
      .setDescription(
        'An internal feedback board. Every endpoint needs a signed-in person except the ' +
          'health checks and the sign-in handshake. Errors all share one shape.',
      )
      .setVersion('1')
      .addCookieAuth('at', { type: 'apiKey', in: 'cookie', name: 'at' })
      .build(),
  );

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

export { ValidationFailedError };
