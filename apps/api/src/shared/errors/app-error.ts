/**
 * One error shape for the whole app (R-76). Decided once, reused everywhere
 * (R-150).
 *
 *   code      — a stable machine code. The front end turns it into words in the
 *               person's language. Never a sentence to show a person as-is.
 *   message   — English, for the logs and for a developer reading a response.
 *   fields    — only when a form is wrong: field name -> code for that field.
 *   requestId — the id that follows one call through the system (R-119), given
 *               to the person so support can find it (R-100).
 *   retryAt   — only when a rate limit refused the call (R-131).
 *
 * R-100: an error never carries a stack, database text, or a library name.
 * Everything that could leak the inside of the system is dropped here, once,
 * rather than remembered at every throw site.
 */

export type ErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'FEATURE_DISABLED'
  | 'SIGNUP_NOT_ALLOWED'
  | 'SERVICE_UNAVAILABLE'
  | 'TOO_MANY_REQUESTS'
  | 'SIGNUP_RATE_LIMITED'
  | 'SUBMISSION_RATE_LIMITED'
  | 'VOTE_RATE_LIMITED'
  | 'INTERNAL_ERROR';

/** field name -> the code for what is wrong with that one field. */
export type FieldErrors = Readonly<Record<string, string>>;

export interface ErrorResponseBody {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly requestId: string;
    readonly fields?: FieldErrors;
    readonly retryAt?: string;
  };
}

/** Ours. Anything that is not an AppError is a bug, and becomes a plain 500. */
export abstract class AppError extends Error {
  public abstract readonly code: ErrorCode;
  public abstract readonly httpStatus: number;
  public readonly fields?: FieldErrors;
  public readonly retryAt?: Date;

  protected constructor(message: string, extra?: { fields?: FieldErrors; retryAt?: Date }) {
    super(message);
    this.name = new.target.name;
    this.fields = extra?.fields;
    this.retryAt = extra?.retryAt;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class NotFoundError extends AppError {
  public readonly code = 'NOT_FOUND' as const;
  public readonly httpStatus = 404;

  /**
   * `id` is kept for the log only. It is never put in the message, because
   * confirming which ids exist is itself a small leak (R-94).
   */
  public constructor(
    public readonly what: string,
    public readonly id: string,
  ) {
    super(`${what} was not found.`);
  }
}

export class ValidationFailedError extends AppError {
  public readonly code = 'VALIDATION_FAILED' as const;
  public readonly httpStatus = 400;

  public constructor(fields: FieldErrors) {
    super('The submitted values are not valid.', { fields });
  }
}

/** Not signed in. Never used for "signed in but not allowed" (R-6). */
export class UnauthorizedError extends AppError {
  public readonly code = 'UNAUTHORIZED' as const;
  public readonly httpStatus = 401;

  public constructor(message = 'You are not signed in.') {
    super(message);
  }
}

/** Signed in, but the saved row says no (R-7). Never used for "not signed in". */
export class ForbiddenError extends AppError {
  public readonly code = 'FORBIDDEN' as const;
  public readonly httpStatus = 403;

  public constructor(message = 'You are not allowed to do this.') {
    super(message);
  }
}

export class ConflictError extends AppError {
  public readonly code = 'CONFLICT' as const;
  public readonly httpStatus = 409;

  public constructor(message: string) {
    super(message);
  }
}

/**
 * A feature switch that is off refuses on the server, not only in the screen
 * (R-42, H-5).
 */
export class FeatureDisabledError extends AppError {
  public readonly code = 'FEATURE_DISABLED' as const;
  public readonly httpStatus = 403;

  /**
   * One switch exists today (R-42). When a second one is added, this map is the
   * only place that needs a line — and TypeScript will refuse to compile until
   * it has one.
   */
  public constructor(feature: 'comments') {
    super({ comments: 'Comments are switched off.' }[feature]);
  }
}

export type RateLimitedCode =
  | 'SIGNUP_RATE_LIMITED'
  | 'SUBMISSION_RATE_LIMITED'
  | 'VOTE_RATE_LIMITED';

/**
 * R-131: the refusal says when the person may try again, and that time is one
 * window after their oldest attempt — not one window from now.
 */
export class RateLimitedError extends AppError {
  public readonly httpStatus = 429;

  public constructor(
    public readonly code: RateLimitedCode,
    retryAt: Date,
  ) {
    super('You have reached the limit. You can try again later.', { retryAt });
  }
}

/** The sign-up rule said no. Different from the sign-up limit, which says "later". */
export class SignupNotAllowedError extends AppError {
  public readonly code = 'SIGNUP_NOT_ALLOWED' as const;
  public readonly httpStatus = 403;

  public constructor(message: string) {
    super(message);
  }
}

/**
 * Turns anything thrown into the one shape. An error that is not ours becomes a
 * plain 500 carrying nothing but the id (R-100) — the real story goes to the log.
 */
export function toErrorResponse(error: unknown, requestId: string): ErrorResponseBody {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.fields ? { fields: error.fields } : {}),
        ...(error.retryAt ? { retryAt: error.retryAt.toISOString() } : {}),
      },
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Quote this id when asking for help.',
      requestId,
    },
  };
}
