import { Inject, Injectable } from '@nestjs/common';
import pino, { Logger as PinoLogger } from 'pino';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from '../config/environment.token';

/**
 * R-119: logs are machine readable, carry the id that follows one call through
 * the system, and never contain a password, a token, or a person's private data.
 *
 * The redaction list below is the whole of that last promise. It is a denylist
 * by path, which means a *new* place a token could appear is not covered until
 * it is added here — so the rule when adding a log line is: log ids, not
 * objects. `err` is allowed through whole because an error carries the story we
 * need, and our own errors (R-100) are built to hold nothing private.
 */
const REDACTED = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.clientSecret',
  // An email address is a person's private data (R-99). Log the user id.
  '*.email',
  'user.email',
];

@Injectable()
export class Logger {
  private readonly pino: PinoLogger;

  public constructor(@Inject(APP_ENVIRONMENT) environment: AppEnvironmentToken) {
    this.pino = pino({
      level: environment.logLevel,
      redact: { paths: REDACTED, censor: '[redacted]' },
      formatters: {
        level: (label) => ({ level: label }),
      },
      // One field name for the id, everywhere.
      base: { service: 'feedbackhub-api' },
    });
  }

  public debug(meta: Record<string, unknown>, message: string): void {
    this.pino.debug(meta, message);
  }

  public info(meta: Record<string, unknown>, message: string): void {
    this.pino.info(meta, message);
  }

  public warn(meta: Record<string, unknown>, message: string): void {
    this.pino.warn(meta, message);
  }

  public error(meta: Record<string, unknown>, message: string): void {
    this.pino.error(meta, message);
  }
}
