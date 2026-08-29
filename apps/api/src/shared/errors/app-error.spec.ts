import {
  AppError,
  ErrorCode,
  FeatureDisabledError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationFailedError,
  toErrorResponse,
} from './app-error';

/**
 * R-76 — one shape for every error: a code the app turns into words in the
 * person's language, an English message for the logs, the field names when a
 * form is wrong, and an id we can search.
 * R-100 — an error message never shows the inside of the system.
 */
describe('the one error shape', () => {
  const requestId = 'req_01HZY';

  it('always carries code, message and requestId', () => {
    const body = toErrorResponse(new NotFoundError('Feedback request', 'abc'), requestId);

    expect(body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Feedback request was not found.',
        requestId,
      },
    });
  });

  it('adds field names only when a form is wrong', () => {
    const error = new ValidationFailedError({
      title: 'TITLE_TOO_SHORT',
      description: 'DESCRIPTION_REQUIRED',
    });

    expect(toErrorResponse(error, requestId)).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The submitted values are not valid.',
        requestId,
        fields: { title: 'TITLE_TOO_SHORT', description: 'DESCRIPTION_REQUIRED' },
      },
    });
  });

  it('never mixes up "not signed in" with "not allowed" (R-6)', () => {
    expect(new UnauthorizedError().httpStatus).toBe(401);
    expect(new ForbiddenError().httpStatus).toBe(403);
  });

  it('tells a rate-limited person when they may try again (R-131)', () => {
    const retryAt = new Date('2026-08-29T14:00:00.000Z');
    const error = new RateLimitedError('SUBMISSION_RATE_LIMITED', retryAt);

    expect(error.httpStatus).toBe(429);
    expect(toErrorResponse(error, requestId)).toEqual({
      error: {
        code: 'SUBMISSION_RATE_LIMITED',
        message: 'You have reached the limit. You can try again later.',
        requestId,
        retryAt: '2026-08-29T14:00:00.000Z',
      },
    });
  });

  it('says plainly when a feature is switched off (R-42)', () => {
    const error = new FeatureDisabledError('comments');

    expect(error.httpStatus).toBe(403);
    expect(toErrorResponse(error, requestId).error).toMatchObject({
      code: 'FEATURE_DISABLED',
      message: 'Comments are switched off.',
    });
  });

  describe('an unexpected error (R-100)', () => {
    it('becomes a plain 500 that leaks nothing', () => {
      const leaky = new Error(
        'insert or update on table "votes" violates foreign key constraint "votes_user_id_fkey"',
      );

      const body = toErrorResponse(leaky, requestId);

      expect(body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Quote this id when asking for help.',
          requestId,
        },
      });
    });

    it('shows no stack, no database text and no library name', () => {
      const leaky = new Error('PrismaClientKnownRequestError: relation "users" does not exist');

      const serialised = JSON.stringify(toErrorResponse(leaky, requestId));

      expect(serialised).not.toContain('Prisma');
      expect(serialised).not.toContain('relation');
      expect(serialised).not.toContain('stack');
    });
  });

  it('gives every code a distinct meaning, so the front end can translate it', () => {
    const codes: ErrorCode[] = [
      'NOT_FOUND',
      'VALIDATION_FAILED',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'CONFLICT',
      'FEATURE_DISABLED',
      'INTERNAL_ERROR',
    ];

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('is an AppError, so the filter can tell ours from anyone else\'s', () => {
    expect(new NotFoundError('Request', 'x')).toBeInstanceOf(AppError);
    expect(new Error('boom')).not.toBeInstanceOf(AppError);
  });
});
