import { NotificationJob } from '../../domain/entity/notification-job';
import { OutgoingEmail } from '../port/notification-ports';

/**
 * R-57: the email is written in the person's language, chosen at the moment the
 * event happens — which is why the language is kept on the server and not in the
 * browser (SRS 12.2). A missing word shows in English, never as a code word.
 *
 * Plain text only. Nothing a person typed is put into a message body as markup,
 * which keeps R-98 true beyond the screen as well.
 *
 * This lives in `application` and not `infrastructure` because it is pure logic
 * with no I/O: it turns a job and a recipient into words. The thing that talks
 * to an SMTP server is the infrastructure part.
 */
export type Language = 'en' | 'ar';

interface Copy {
  readonly commentSubject: (title: string) => string;
  readonly commentBody: (who: string, title: string, url: string) => string;
  readonly statusSubject: (title: string) => string;
  readonly statusBody: (title: string, status: string, url: string) => string;
  readonly invitationSubject: () => string;
  readonly invitationBody: (url: string) => string;
}

const ENGLISH: Copy = {
  commentSubject: (title) => `New comment on "${title}"`,
  commentBody: (who, title, url) =>
    `${who} commented on your request "${title}".\n\nRead it here: ${url}\n\n` +
    `You can turn these emails off in your settings.`,
  statusSubject: (title) => `"${title}" has a new status`,
  statusBody: (title, status, url) =>
    `Your request "${title}" is now: ${status}.\n\nSee it here: ${url}\n\n` +
    `You can turn these emails off in your settings.`,
  invitationSubject: () => 'You have been invited to FeedbackHub',
  invitationBody: (url) =>
    `You have been invited to join FeedbackHub.\n\nSign up here: ${url}`,
};

const ARABIC: Copy = {
  commentSubject: (title) => `تعليق جديد على "${title}"`,
  commentBody: (who, title, url) =>
    `علّق ${who} على طلبك "${title}".\n\nاقرأه هنا: ${url}\n\n` +
    `يمكنك إيقاف هذه الرسائل من الإعدادات.`,
  statusSubject: (title) => `تغيّرت حالة "${title}"`,
  statusBody: (title, status, url) =>
    `طلبك "${title}" أصبح الآن: ${status}.\n\nاطّلع عليه هنا: ${url}\n\n` +
    `يمكنك إيقاف هذه الرسائل من الإعدادات.`,
  invitationSubject: () => 'دعوة للانضمام إلى FeedbackHub',
  invitationBody: (url) => `تمت دعوتك للانضمام إلى FeedbackHub.\n\nسجّل هنا: ${url}`,
};

/** Falls back to English rather than showing a code word (R-57). */
function copyFor(language: string): Copy {
  return language === 'ar' ? ARABIC : ENGLISH;
}

export function renderNotification(
  job: NotificationJob,
  recipient: { email: string; language: string },
  appBaseUrl: string,
): OutgoingEmail {
  const copy = copyFor(recipient.language);

  switch (job.kind) {
    case 'comment_on_my_request': {
      const url = `${appBaseUrl}/requests/${job.requestId}`;
      return {
        to: recipient.email,
        subject: copy.commentSubject(job.requestTitle),
        body: copy.commentBody(job.commenterName, job.requestTitle, url),
      };
    }
    case 'status_changed_on_my_request': {
      const url = `${appBaseUrl}/requests/${job.requestId}`;
      return {
        to: recipient.email,
        subject: copy.statusSubject(job.requestTitle),
        body: copy.statusBody(job.requestTitle, job.newStatusName, url),
      };
    }
    case 'invitation':
      return {
        to: job.email,
        subject: copy.invitationSubject(),
        body: copy.invitationBody(job.signUpUrl),
      };
  }
}
