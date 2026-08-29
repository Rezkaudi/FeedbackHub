import { NotificationJob } from '../../domain/entity/notification-job';

/**
 * R-74: the email is sent after the action is saved, in a background job, never
 * inside the request.
 */
export interface NotificationQueue {
  /**
   * Must never throw. R-72: writing the message can never break or slow down
   * the thing the person just did, so a queue that is unreachable is a logged
   * warning and a dropped email, not a failed comment.
   */
  enqueue(job: NotificationJob): Promise<void>;

  /** Used by the worker only. Returns null when nothing arrived in time. */
  dequeue(timeoutSeconds: number): Promise<NotificationJob | null>;
}

export interface OutgoingEmail {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export interface MailSender {
  /** R-127: a failure is written to the log and dropped. There is no retry. */
  send(email: OutgoingEmail): Promise<void>;
}

export const NOTIFICATION_QUEUE = Symbol('NotificationQueue');
export const MAIL_SENDER = Symbol('MailSender');
