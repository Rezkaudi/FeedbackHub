import { ValidationFailedError } from '../../../../shared/errors/app-error';

/**
 * R-33b: the list is read with a cursor, not with page numbers.
 *
 * Why: the order is newest-first, so a new comment arriving while someone is
 * reading shifts every page number by one, and page 2 would repeat a comment
 * they already saw or skip one they did not. A cursor points at a *row*, so it
 * survives insertions above it.
 *
 * The cursor is the created_at and id of the last row sent, and it means nothing
 * to the browser — it is opaque on purpose, so no client starts building one.
 */
export interface CommentCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export function encodeCursor(cursor: CommentCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(value: string | undefined): CommentCursor | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  const separator = decoded.indexOf('|');

  if (separator < 0) {
    throw new ValidationFailedError({ cursor: 'CURSOR_IS_NOT_VALID' });
  }

  const createdAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);

  if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
    throw new ValidationFailedError({ cursor: 'CURSOR_IS_NOT_VALID' });
  }

  return { createdAt, id };
}
