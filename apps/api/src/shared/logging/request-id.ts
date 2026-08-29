import { randomUUID } from 'node:crypto';

/**
 * One id per call, attached to the request and echoed to the person in every
 * error (R-119, R-100).
 *
 * A caller may supply one — that is how a single id spans the API and the email
 * worker — but only if it is a plain uuid. Anything else is replaced: an id goes
 * straight into log lines, and a caller-controlled string with a newline in it
 * could forge a log entry.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where we keep it on the request object. */
const FIELD = 'requestId';

interface RequestLike {
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

export function attachRequestId(request: RequestLike): string {
  const supplied = request.headers?.[REQUEST_ID_HEADER];
  const id = typeof supplied === 'string' && UUID.test(supplied) ? supplied : randomUUID();

  request[FIELD] = id;
  return id;
}

export function readRequestId(request: RequestLike): string {
  const id = request[FIELD];
  return typeof id === 'string' ? id : 'unknown';
}
