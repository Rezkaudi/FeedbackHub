import { FeedbackRequest } from '../../domain/entity/feedback-request';
import { BoardPage, BoardQuery, BoardRow } from '../../domain/entity/board-query';

/**
 * Who is looking. Needed because the comment count is different for different
 * people: a waiting comment is counted only for its writer and for admins
 * (R-33c), so two people can see two different totals and both be right.
 */
export interface BoardViewer {
  readonly id: string;
  readonly isAdmin: boolean;
}

export interface RequestRepository {
  /**
   * R-148: one SQL statement — search, filters, sort, pinned-first, page and
   * the two derived counts. Every value a bound parameter (R-97).
   */
  board(query: BoardQuery, viewer: BoardViewer, commentsEnabled: boolean): Promise<BoardPage>;

  /**
   * One request with the same derived counts the board shows, built from the
   * same statement, so the two screens can never disagree (R-28, R-150).
   */
  boardRow(
    requestId: string,
    viewer: BoardViewer,
    commentsEnabled: boolean,
  ): Promise<BoardRow | null>;

  findById(id: string): Promise<FeedbackRequest | null>;
  save(request: FeedbackRequest): Promise<FeedbackRequest>;
  remove(id: string): Promise<void>;

  /**
   * R-130 + R-132: the submission limit and the insert in one database step.
   *
   * R-131 has a wrinkle here that the other two limits do not have: "a deleted
   * request still counts while it is inside the window — otherwise write,
   * delete, write again walks round the limit". Deleting a request removes its
   * row, so the rows cannot be the counter. See the repository for what is.
   */
  createWithinSubmissionLimit(
    request: FeedbackRequest,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<FeedbackRequest>;
}

export const REQUEST_REPOSITORY = Symbol('RequestRepository');
