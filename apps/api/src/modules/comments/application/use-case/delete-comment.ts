import { Inject, Injectable } from '@nestjs/common';
import { COMMENT_REPOSITORY, CommentRepository } from '../port/comment-repository';
import { CommentsMustBeEnabled } from './comments-must-be-enabled';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';
import { ForbiddenError, NotFoundError } from '../../../../shared/errors/app-error';

/**
 * R-37: the writer can delete their own comment; an admin can delete any.
 * The row is removed from the database completely — no tombstone, no grey line
 * (this reverses the original R-38; see DECISIONS.md).
 */
@Injectable()
export class DeleteComment {
  public constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly commentsEnabled: CommentsMustBeEnabled,
  ) {}

  public async execute(commentId: string, actor: AuthenticatedUser): Promise<void> {
    await this.commentsEnabled.check();

    const comment = await this.comments.findById(commentId);
    if (comment === null) {
      throw new NotFoundError('Comment', commentId);
    }

    if (actor.role !== 'admin' && comment.authorId !== actor.id) {
      throw new ForbiddenError('This comment belongs to someone else.');
    }

    await this.comments.remove(commentId);
  }
}
