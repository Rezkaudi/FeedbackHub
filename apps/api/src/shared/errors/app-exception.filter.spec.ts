import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppExceptionFilter } from './app-exception.filter';
import { ForbiddenError, RateLimitedError } from './app-error';

/**
 * Every error leaves the app through here, so the shape of R-76 is impossible to
 * get wrong at a throw site, and R-100 is enforced in one place.
 */
describe('AppExceptionFilter', () => {
  const requestId = '11111111-2222-3333-4444-555555555555';

  const captured = { status: 0, body: undefined as unknown };
  const logged: { level: string; message: string; meta: Record<string, unknown> }[] = [];

  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ requestId, method: 'POST', url: '/v1/requests' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  const logger = {
    warn: (meta: Record<string, unknown>, message: string) =>
      logged.push({ level: 'warn', message, meta }),
    error: (meta: Record<string, unknown>, message: string) =>
      logged.push({ level: 'error', message, meta }),
  };

  const filter = new AppExceptionFilter(logger);

  beforeEach(() => {
    captured.status = 0;
    captured.body = undefined;
    logged.length = 0;
  });

  it('renders one of ours with its own status and code', () => {
    filter.catch(new ForbiddenError(), host);

    expect(captured.status).toBe(403);
    expect(captured.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'You are not allowed to do this.',
        requestId,
      },
    });
  });

  it('keeps retryAt on a rate limit refusal (R-131)', () => {
    filter.catch(new RateLimitedError('VOTE_RATE_LIMITED', new Date('2026-08-29T14:00:00Z')), host);

    expect(captured.status).toBe(429);
    expect(captured.body).toMatchObject({
      error: { code: 'VOTE_RATE_LIMITED', retryAt: '2026-08-29T14:00:00.000Z' },
    });
  });

  it('turns a framework 404 into our shape, not Nest\'s', () => {
    filter.catch(new NotFoundException(), host);

    expect(captured.status).toBe(404);
    expect(captured.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not found.', requestId },
    });
  });

  it('turns the validation pipe\'s complaint into field codes (R-88)', () => {
    const nestValidationError = new BadRequestException({
      message: ['title must be longer than or equal to 5 characters', 'category should not be empty'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(nestValidationError, host);

    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({
      error: {
        code: 'VALIDATION_FAILED',
        fields: {
          title: 'title must be longer than or equal to 5 characters',
          category: 'category should not be empty',
        },
      },
    });
  });

  describe('an error that is not ours', () => {
    const leaky = new Error('connect ECONNREFUSED 10.0.0.5:5432');

    it('becomes a plain 500 that leaks nothing (R-100)', () => {
      filter.catch(leaky, host);

      expect(captured.status).toBe(500);
      expect(JSON.stringify(captured.body)).not.toContain('ECONNREFUSED');
      expect(JSON.stringify(captured.body)).not.toContain('5432');
    });

    it('writes the real story to the log, with the same id the person was given', () => {
      filter.catch(leaky, host);

      expect(logged).toHaveLength(1);
      expect(logged[0]?.level).toBe('error');
      expect(logged[0]?.meta).toMatchObject({ requestId });
      expect(logged[0]?.meta.err).toBe(leaky);
    });
  });

  it('logs an expected refusal at warn, not error — a 403 is not a fault', () => {
    filter.catch(new ForbiddenError(), host);

    expect(logged[0]?.level).toBe('warn');
  });
});

/**
 * Found by running the real container: /health/ready threw Nest's
 * ServiceUnavailableException and this filter turned it into a 500, so the
 * probe reported the wrong reason. A probe that lies is worse than no probe
 * (R-83), so the status is now always preserved.
 */
describe('AppExceptionFilter and statuses it was not taught', () => {
  const requestId = '11111111-2222-3333-4444-555555555555';
  const captured = { status: 0, body: undefined as unknown };

  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ requestId }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  const filter = new AppExceptionFilter({ warn: () => undefined, error: () => undefined });

  it('keeps 503 as 503, so a readiness probe tells the truth (R-83)', () => {
    filter.catch(new ServiceUnavailableException(), host);

    expect(captured.status).toBe(503);
    expect(captured.body).toMatchObject({ error: { code: 'SERVICE_UNAVAILABLE' } });
  });

  it('leaks nothing for a status it does not know', () => {
    filter.catch(new HttpException('teapot internals', 418), host);

    expect(captured.status).toBe(418);
    expect(JSON.stringify(captured.body)).not.toContain('internals');
  });
});
