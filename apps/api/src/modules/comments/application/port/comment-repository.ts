import { Comment } from '../../domain/entity/comment';
import { CommentCursor } from '../../domain/entity/comment-cursor';

export interface CommentViewer {
  readonly id: string;
  readonly isAdmin: boolean;
}

export interface CommentPage {
  readonly comments: readonly Comment[];
  /** Empty means the end (R-33b). */
  readonly nextCursor: string | null;
  /** Counted for the person asking (R-33c). */
  readonly total: number;
}

export interface CommentRepository {
  /** R-33, R-33a, R-33b: flat, newest first, id as the tie-breaker, by cursor. */
  list(
    requestId: string,
    viewer: CommentViewer,
    limit: number,
    cursor: CommentCursor | undefined,
  ): Promise<CommentPage>;

  findById(id: string): Promise<Comment | null>;
  add(comment: Comment): Promise<Comment>;
  save(comment: Comment): Promise<Comment>;
  listPending(): Promise<Comment[]>;
}

export const COMMENT_REPOSITORY = Symbol('CommentRepository');
