import { ForbiddenError, NotFoundError } from '../../../../shared/errors/app-error';
import { FeedbackRequest } from '../../domain/entity/feedback-request';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';

/**
 * Link four of the guard chain (R-138): the permission check **on the saved
 * row**. Written once and reused, so "only mine, or an admin" cannot be spelled
 * two different ways in two use cases (R-150).
 *
 * R-7 is the point: the row decides, not an id or a role the browser sent.
 *
 * A missing row is 404 and a row that is not yours is 403 — deliberately
 * different, because they are different facts and SRS 15.2 shows the person
 * different screens for them. This does leak that an id exists, which is
 * accepted: on a board where every signed-in person can already read every
 * request, that is not a secret (R-94 is about reaching another person's
 * *things*, and a request is nobody's private thing).
 */
export function loadOwnedOrAdmin(
  request: FeedbackRequest | null,
  requestId: string,
  user: AuthenticatedUser,
): FeedbackRequest {
  if (request === null) {
    throw new NotFoundError('Feedback request', requestId);
  }

  if (user.role !== 'admin' && !request.isOwnedBy(user.id)) {
    throw new ForbiddenError('This request belongs to someone else.');
  }

  return request;
}

export function loadExisting(
  request: FeedbackRequest | null,
  requestId: string,
): FeedbackRequest {
  if (request === null) {
    throw new NotFoundError('Feedback request', requestId);
  }

  return request;
}
