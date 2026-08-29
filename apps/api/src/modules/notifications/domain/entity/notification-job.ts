/**
 * The three events that produce an email, and nothing else (R-73).
 *
 * A job carries *ids and plain values*, never an entity and never a rendered
 * message. Two reasons: it crosses a process boundary to the worker (R-144), and
 * whatever it holds may sit in Redis for a moment — so it must contain nothing
 * that would be a leak at rest. The recipient's address is looked up by the
 * worker at send time, not carried here.
 */
export type NotificationJob =
  | {
      readonly kind: 'comment_on_my_request';
      readonly requestId: string;
      readonly requestTitle: string;
      readonly recipientId: string;
      readonly commenterName: string;
    }
  | {
      readonly kind: 'status_changed_on_my_request';
      readonly requestId: string;
      readonly requestTitle: string;
      readonly recipientId: string;
      readonly newStatusName: string;
    }
  | {
      readonly kind: 'invitation';
      /** The invited person has no account and no settings yet (R-126). */
      readonly email: string;
      readonly signUpUrl: string;
    };

export type NotificationKind = NotificationJob['kind'];
