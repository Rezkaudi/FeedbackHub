import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_QUEUE, NotificationQueue } from './application/port/notification-ports';
import { SettingsService } from '../settings/settings.service';
import { Logger } from '../../shared/logging/logger';

/**
 * The published service (R-141). `requests`, `comments` and `invitations` call
 * it; none of them knows an email exists beyond this.
 *
 * Two promises are kept here, in one place, so no caller can forget either:
 *
 *   R-71 — nobody is told about their own action, and only if they asked for it.
 *   R-72 — this can never break or slow down what the person just did. Every
 *          method swallows its own failures, because the alternative is a failed
 *          email undoing a saved comment.
 */
@Injectable()
export class NotificationsService {
  public constructor(
    @Inject(NOTIFICATION_QUEUE) private readonly queue: NotificationQueue,
    private readonly settings: SettingsService,
    private readonly logger: Logger,
  ) {}

  public async commentAddedTo(event: {
    requestId: string;
    requestTitle: string;
    authorId: string;
    commenterId: string;
    commenterName: string;
  }): Promise<void> {
    // R-71: nobody is told about their own action.
    if (event.authorId === event.commenterId) {
      return;
    }

    await this.enqueueIfWanted(event.authorId, 'notifyOnComment', {
      kind: 'comment_on_my_request',
      requestId: event.requestId,
      requestTitle: event.requestTitle,
      recipientId: event.authorId,
      commenterName: event.commenterName,
    });
  }

  public async requestStatusChanged(event: {
    requestId: string;
    requestTitle: string;
    authorId: string;
    actorId: string;
    newStatusName: string;
  }): Promise<void> {
    if (event.authorId === event.actorId) {
      return;
    }

    await this.enqueueIfWanted(event.authorId, 'notifyOnStatusChange', {
      kind: 'status_changed_on_my_request',
      requestId: event.requestId,
      requestTitle: event.requestTitle,
      recipientId: event.authorId,
      newStatusName: event.newStatusName,
    });
  }

  /** R-126: an invitation needs no preference check — they have no account yet. */
  public async invitationCreated(email: string, signUpUrl: string): Promise<void> {
    await this.safely(() => this.queue.enqueue({ kind: 'invitation', email, signUpUrl }));
  }

  private async enqueueIfWanted(
    recipientId: string,
    preference: 'notifyOnComment' | 'notifyOnStatusChange',
    job: Parameters<NotificationQueue['enqueue']>[0],
  ): Promise<void> {
    await this.safely(async () => {
      const settings = await this.settings.settingsFor(recipientId);

      if (!settings[preference]) {
        return;
      }

      await this.queue.enqueue(job);
    });
  }

  /**
   * R-72, R-116: a side job that is not part of what the person asked for can
   * never break what they asked for. Anything thrown in here is logged and
   * dropped on purpose.
   */
  private async safely(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error({ err: error }, 'Could not queue a notification; it was dropped');
    }
  }
}
