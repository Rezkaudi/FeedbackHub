import { Inject, Injectable } from '@nestjs/common';
import { COMMENT_REPOSITORY, CommentRepository } from '../port/comment-repository';
import { CommentsMustBeEnabled } from './comments-must-be-enabled';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';
import { ForbiddenError, NotFoundError } from '../../../../shared/errors/app-error';
import { CLOCK, type Clock } from '../../../../shared/ports';

/**
 * R-37: the writer can delete their own comment; an admin can delete any.
 * R-38: what is left is a grey line — the row stays so the thread still makes
 *       sense, and the text is gone for good.
 */
@Injectable()
export class DeleteComment {
  public constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly commentsEnabled: CommentsMustBeEnabled,
    @Inject(CLOCK) private readonly clock: Clock,
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

    comment.delete(this.clock.now());
    await this.comments.save(comment);
  }
}
