import { Inject, Injectable } from '@nestjs/common';
import { COMMENT_REPOSITORY, CommentRepository } from '../port/comment-repository';
import { Comment } from '../../domain/entity/comment';
import { RequestsService } from '../../../requests/requests.service';
import { IdentityService } from '../../../identity/identity.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotFoundError } from '../../../../shared/errors/app-error';

/**
 * R-41: an admin approves a waiting comment (it appears) or rejects it (it is
 * deleted for good).
 *
 * R-125 is the subtle part: the email goes out **when the comment becomes
 * visible**, which is here — not when it was written. A comment the admin
 * rejects is never emailed at all.
 */
@Injectable()
export class ModerateComment {
  public constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly requests: RequestsService,
    private readonly identity: IdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  public listWaiting(): Promise<Comment[]> {
    return this.comments.listPending();
  }

  public async approve(commentId: string): Promise<Comment> {
    const comment = await this.load(commentId);
    comment.approve();
    const saved = await this.comments.save(comment);

    const request = await this.requests.summaryOf(saved.requestId);
    if (request !== null) {
      const commenter = await this.identity.findActiveUser(saved.authorId);

      await this.notifications.commentAddedTo({
        requestId: request.id,
        requestTitle: request.title,
        authorId: request.authorId,
        commenterId: saved.authorId,
        commenterName: commenter.displayName,
      });
    }

    return saved;
  }

  public async reject(commentId: string): Promise<void> {
    await this.load(commentId);
    // No email, ever, for a rejected comment (R-125).
    await this.comments.remove(commentId);
  }

  private async load(commentId: string): Promise<Comment> {
    const comment = await this.comments.findById(commentId);

    if (comment === null) {
      throw new NotFoundError('Comment', commentId);
    }

    return comment;
  }
}
