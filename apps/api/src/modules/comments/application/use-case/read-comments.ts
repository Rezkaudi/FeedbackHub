import { Inject, Injectable } from '@nestjs/common';
import { COMMENT_REPOSITORY, CommentPage, CommentRepository } from '../port/comment-repository';
import { CommentsMustBeEnabled } from './comments-must-be-enabled';
import { decodeCursor } from '../../domain/entity/comment-cursor';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';

/** R-33, R-33b, R-33c. Newest first, by cursor, counted for the person asking. */
@Injectable()
export class ReadComments {
  public constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly commentsEnabled: CommentsMustBeEnabled,
  ) {}

  public async execute(
    requestId: string,
    viewer: AuthenticatedUser,
    options: { limit: number; cursor?: string },
  ): Promise<CommentPage> {
    // R-42: with the switch off the thread is gone, on the screen and here.
    await this.commentsEnabled.check();

    return this.comments.list(
      requestId,
      { id: viewer.id, isAdmin: viewer.role === 'admin' },
      options.limit,
      decodeCursor(options.cursor),
    );
  }
}
