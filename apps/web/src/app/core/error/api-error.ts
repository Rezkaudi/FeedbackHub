import { HttpErrorResponse } from '@angular/common/http';

/**
 * One failure type for the whole app (R-150), built from the server's one error
 * shape (R-76).
 *
 * Nothing downstream ever sees an HttpErrorResponse. A screen asks this type
 * three questions — what happened, can I try again, and which fields were
 * wrong — and every one of them has an answer here even when what came back was
 * an HTML error page from a proxy that has never heard of us.
 */

/**
 * The server's codes, plus one of ours. `NETWORK_UNAVAILABLE` has no server
 * counterpart on purpose: it means the browser never got an answer at all, and
 * it is the one failure where trying again is genuinely likely to work.
 */
export type ApiErrorCode =
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
  | 'INTERNAL_ERROR'
  | 'NETWORK_UNAVAILABLE';

export interface ApiError {
  readonly code: ApiErrorCode;
  /** English, from the server. For the log and as a last-resort fallback. The
   * screen shows a translation of `code`, not this. */
  readonly message: string;
  /** The id to quote when asking for help (R-100). Empty if we never got one. */
  readonly requestId: string;
  readonly status: number;
  /** Only when a form was refused: field name -> what is wrong with it (R-88). */
  readonly fields?: Readonly<Record<string, string>>;
  /** Only when a rate limit refused the call (R-131). */
  readonly retryAt?: Date;
  /** R-87: whether the error should offer a Try again button at all. */
  readonly isRetryable: boolean;
}

const CODES = new Set<string>([
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'FEATURE_DISABLED',
  'SIGNUP_NOT_ALLOWED',
  'SERVICE_UNAVAILABLE',
  'TOO_MANY_REQUESTS',
  'SIGNUP_RATE_LIMITED',
  'SUBMISSION_RATE_LIMITED',
  'VOTE_RATE_LIMITED',
  'INTERNAL_ERROR',
]);

interface WireError {
  code?: unknown;
  message?: unknown;
  requestId?: unknown;
  fields?: unknown;
  retryAt?: unknown;
}

function wireErrorOf(body: unknown): WireError | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return null;
  }
  const inner = (body as { error: unknown }).error;
  return typeof inner === 'object' && inner !== null ? (inner as WireError) : null;
}

function fieldsOf(value: unknown): Readonly<Record<string, string>> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const fields: Record<string, string> = {};
  for (const [name, message] of Object.entries(value)) {
    if (typeof message === 'string') {
      fields[name] = message;
    }
  }

  return Object.keys(fields).length > 0 ? fields : undefined;
}

function retryAtOf(value: unknown): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const moment = new Date(value);
  return Number.isNaN(moment.getTime()) ? undefined : moment;
}

/**
 * R-87: an error must say whether trying again helps, because that is what
 * decides whether a Try again button appears.
 *
 * A refusal will refuse again, so no button. A rate limit gets no button
 * either — not because retrying is pointless forever, but because the screen
 * shows the time from `retryAt` instead, and a button that fails until then is
 * worse than a sentence that says when.
 */
function retryable(status: number, code: ApiErrorCode): boolean {
  if (code === 'NETWORK_UNAVAILABLE') {
    return true;
  }
  if (status === 429) {
    return false;
  }
  return status >= 500;
}

export function toApiError(cause: unknown): ApiError {
  const response = cause instanceof HttpErrorResponse ? cause : null;
  const status = response?.status ?? 0;

  /**
   * Only a *response* with status 0 means the browser could not reach the
   * server — offline, DNS, a blocked request, CORS. Anything that is not an
   * HttpErrorResponse at all is a fault in our own code, and calling that a
   * network problem would tell the person to check their connection and offer
   * a Try again button for a bug that will fail identically every time.
   */
  if (response !== null && status === 0) {
    return {
      code: 'NETWORK_UNAVAILABLE',
      message: 'The server could not be reached.',
      requestId: '',
      status: 0,
      isRetryable: true,
    };
  }

  const wire = wireErrorOf(response?.error);
  const code =
    typeof wire?.code === 'string' && CODES.has(wire.code)
      ? (wire.code as ApiErrorCode)
      : 'INTERNAL_ERROR';

  return {
    code,
    // Never `String(cause)`: that is how a stack ends up on a screen (R-100).
    message:
      typeof wire?.message === 'string' && wire.message.length > 0
        ? wire.message
        : 'Something went wrong.',
    requestId: typeof wire?.requestId === 'string' ? wire.requestId : '',
    status,
    fields: fieldsOf(wire?.fields),
    retryAt: retryAtOf(wire?.retryAt),
    isRetryable: retryable(status, code),
  };
}
