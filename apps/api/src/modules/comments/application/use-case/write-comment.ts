import { Inject, Injectable } from '@nestjs/common';
import { COMMENT_REPOSITORY, CommentRepository } from '../port/comment-repository';
import { Comment } from '../../domain/entity/comment';
import { CommentsMustBeEnabled } from './comments-must-be-enabled';
import { RequestsService } from '../../../requests/requests.service';
import { SettingsService } from '../../../settings/settings.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/ports';
import { NotFoundError } from '../../../../shared/errors/app-error';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';

/**
 * R-32: anyone signed in can comment on any request.
 * R-40: when approval is on, the comment waits and only its writer and admins
 *       see it.
 * R-125: the email is sent when the comment becomes *visible*, not when it is
 *        written — so a comment that needs approval emails nobody yet.
 */
@Injectable()
export class WriteComment {
  public constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly commentsEnabled: CommentsMustBeEnabled,
    private readonly requests: RequestsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  public async execute(
    requestId: string,
    body: string,
    author: AuthenticatedUser,
  ): Promise<Comment> {
    await this.commentsEnabled.check();

    // SRS 15.5: a comment on a request that was just deleted -> clear message.
    const request = await this.requests.summaryOf(requestId);
    if (request === null) {
      throw new NotFoundError('Feedback request', requestId);
    }

    const needsApproval = await this.settings.commentsNeedApproval();

    const comment = await this.comments.add(
      Comment.write({ requestId, authorId: author.id, body }, {
        id: this.ids.next(),
        needsApproval,
      }),
    );

    // R-125: not yet visible means not yet emailed. ApproveComment sends it.
    if (!comment.isPending) {
      await this.notifications.commentAddedTo({
        requestId: request.id,
        requestTitle: request.title,
        authorId: request.authorId,
        commenterId: author.id,
        commenterName: author.displayName,
      });
    }

    return comment;
  }
}
