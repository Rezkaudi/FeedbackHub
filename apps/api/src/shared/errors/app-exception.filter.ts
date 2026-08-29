import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable } from '@nestjs/common';
import { AppError, ErrorResponseBody, ValidationFailedError, toErrorResponse } from './app-error';
import { readRequestId } from '../logging/request-id';

/**
 * The one place an error becomes a response (R-76, R-150). Because everything
 * leaves through here, R-100 — no stack, no database text, no library name — is
 * enforced once instead of remembered at every throw site.
 *
 * What the person gets and what the log gets are deliberately different: the
 * person gets a code and an id, the log gets the whole error. They are tied
 * together by that id (R-119).
 */

/** The slice of a logger this filter needs. Keeps it testable with no pino. */
export interface ErrorLogger {
  warn(meta: Record<string, unknown>, message: string): void;
  error(meta: Record<string, unknown>, message: string): void;
}

interface NestValidationBody {
  message?: unknown;
}

/** class-validator writes "title must be longer than …". The field is the first word. */
function toFieldErrors(messages: readonly string[]): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const message of messages) {
    const field = message.split(' ')[0];
    if (field !== undefined && fields[field] === undefined) {
      fields[field] = message;
    }
  }

  return fields;
}

@Injectable()
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  public constructor(private readonly logger: ErrorLogger) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Record<string, unknown>>();
    const response = http.getResponse<{
      status(code: number): { json(body: unknown): unknown };
    }>();

    const requestId = readRequestId(request);
    const { status, body } = this.render(exception, requestId);

    // An expected refusal (401, 403, 404, 409, 422, 429) is not a fault of the
    // system, so it must not page anyone. Only a 5xx is an error.
    if (status >= 500) {
      this.logger.error({ requestId, err: exception, status }, 'Request failed');
    } else {
      this.logger.warn(
        { requestId, status, code: body.error.code },
        'Request refused',
      );
    }

    response.status(status).json(body);
  }

  private render(
    exception: unknown,
    requestId: string,
  ): { status: number; body: ErrorResponseBody } {
    if (exception instanceof AppError) {
      return { status: exception.httpStatus, body: toErrorResponse(exception, requestId) };
    }

    if (exception instanceof HttpException) {
      return this.renderFrameworkError(exception, requestId);
    }

    return { status: 500, body: toErrorResponse(exception, requestId) };
  }

  /**
   * Nest throws its own exceptions — the global ValidationPipe's 400 above all.
   * They are translated into our shape so a caller never has to handle two.
   */
  private renderFrameworkError(
    exception: HttpException,
    requestId: string,
  ): { status: number; body: ErrorResponseBody } {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const messages =
      typeof payload === 'object' && payload !== null
        ? (payload as NestValidationBody).message
        : undefined;

    if (status === 400 && Array.isArray(messages)) {
      const validation = new ValidationFailedError(
        toFieldErrors(messages.filter((m): m is string => typeof m === 'string')),
      );
      return { status: 400, body: toErrorResponse(validation, requestId) };
    }

    // Any other framework exception: keep its status, but say nothing about
    // where it came from.
    //
    // The status is always preserved. Turning an unfamiliar status into 500
    // would make the API lie — a readiness probe answering 503 is the case that
    // caught this, and a probe that reports the wrong reason is worse than none.
    const known: Record<number, { code: ErrorResponseBody['error']['code']; message: string }> = {
      400: { code: 'VALIDATION_FAILED', message: 'The submitted values are not valid.' },
      401: { code: 'UNAUTHORIZED', message: 'You are not signed in.' },
      403: { code: 'FORBIDDEN', message: 'You are not allowed to do this.' },
      404: { code: 'NOT_FOUND', message: 'Not found.' },
      409: { code: 'CONFLICT', message: 'That conflicts with something that already exists.' },
      413: { code: 'VALIDATION_FAILED', message: 'The submitted values are not valid.' },
      429: { code: 'TOO_MANY_REQUESTS', message: 'You have reached the limit. Try again later.' },
      503: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is not ready. Try again shortly.',
      },
    };

    const mapped = known[status] ?? {
      // Unlisted statuses still keep their own status; only the wording is
      // generic, so nothing about the inside of the system leaks (R-100).
      code: (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED') as ErrorResponseBody['error']['code'],
      message:
        status >= 500
          ? 'Something went wrong. Quote this id when asking for help.'
          : 'That request could not be accepted.',
    };

    return {
      status,
      body: { error: { code: mapped.code, message: mapped.message, requestId } },
    };
  }
}
