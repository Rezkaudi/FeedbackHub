import { Inject, Injectable } from '@nestjs/common';
import { COMMENT_REPOSITORY, CommentRepository } from '../port/comment-repository';
import { Comment } from '../../domain/entity/comment';
import { CommentsMustBeEnabled } from './comments-must-be-enabled';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';
import { NotFoundError } from '../../../../shared/errors/app-error';

/**
 * R-35, R-36: the writer can edit their own comment, and an admin cannot edit
 * someone else's. Moderation means deleting, never changing what someone said.
 *
 * The rule itself lives on the entity, because it is the one place where being
 * an admin does not widen what you may do, and a controller check could be
 * loosened by accident.
 */
@Injectable()
export class EditComment {
  public constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly commentsEnabled: CommentsMustBeEnabled,
  ) {}

  public async execute(
    commentId: string,
    body: string,
    editor: AuthenticatedUser,
  ): Promise<Comment> {
    await this.commentsEnabled.check();

    const comment = await this.comments.findById(commentId);
    if (comment === null) {
      throw new NotFoundError('Comment', commentId);
    }

    comment.editBy(body, editor);
    return this.comments.save(comment);
  }
}
