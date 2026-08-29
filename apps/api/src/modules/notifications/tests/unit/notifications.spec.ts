import { NotificationsService } from '../../notifications.service';
import { DeliverNotification } from '../../application/use-case/deliver-notification';
import { renderNotification } from '../../application/render/messages';
import {
  MailSender,
  NotificationQueue,
  OutgoingEmail,
} from '../../application/port/notification-ports';
import { NotificationJob } from '../../domain/entity/notification-job';
import { Logger } from '../../../../shared/logging/logger';
import { IdentityService } from '../../../identity/identity.service';
import { SettingsService } from '../../../settings/settings.service';
import { MySettingsView } from '../../../settings/contract';
import { UserView } from '../../../identity/contract';
import { AppEnvironmentToken } from '../../../../shared/config/environment.token';
import { SmtpMailSender } from '../../infrastructure/mail/smtp-mail-sender';

/**
 * Emails are the one part of this app that is allowed to fail. R-72 says a
 * failure here can never undo or slow down what the person actually did, and
 * R-127 says a failed send is logged and dropped with no retry.
 *
 * That makes "it threw" and "it silently did nothing" the two things worth
 * testing, and both of them are invisible from the outside — so every test below
 * checks what reached the queue or the mail sender, not just that nothing blew
 * up.
 */

class FakeQueue implements NotificationQueue {
  public readonly jobs: NotificationJob[] = [];
  public failOnEnqueue = false;

  public enqueue(job: NotificationJob): Promise<void> {
    if (this.failOnEnqueue) {
      return Promise.reject(new Error('Redis is down'));
    }
    this.jobs.push(job);
    return Promise.resolve();
  }

  public dequeue(): Promise<NotificationJob | null> {
    return Promise.resolve(this.jobs.pop() ?? null);
  }
}

class FakeMailSender implements MailSender {
  public readonly sent: OutgoingEmail[] = [];
  public failOnSend = false;

  public send(email: OutgoingEmail): Promise<void> {
    if (this.failOnSend) {
      return Promise.reject(new Error('SMTP refused the connection'));
    }
    this.sent.push(email);
    return Promise.resolve();
  }
}

const silentLogger = {
  debug: (): void => undefined,
  info: (): void => undefined,
  warn: (): void => undefined,
  error: (): void => undefined,
} as unknown as Logger;

const author = '00000000-0000-4000-8000-0000000000a1';
const someoneElse = '00000000-0000-4000-8000-0000000000b2';

function settingsServiceReturning(settings: Partial<MySettingsView>): SettingsService {
  return {
    settingsFor: (): Promise<MySettingsView> =>
      Promise.resolve({
        language: 'en',
        notifyOnComment: true,
        notifyOnStatusChange: true,
        ...settings,
      }),
  } as unknown as SettingsService;
}

describe('deciding whether an email is even queued', () => {
  let queue: FakeQueue;

  beforeEach(() => {
    queue = new FakeQueue();
  });

  const serviceWith = (settings: Partial<MySettingsView>): NotificationsService =>
    new NotificationsService(queue, settingsServiceReturning(settings), silentLogger);

  const aComment = {
    requestId: '00000000-0000-4000-8000-0000000000c3',
    requestTitle: 'Dark mode',
    authorId: author,
    commenterId: someoneElse,
    commenterName: 'Sam',
  };

  it('queues a comment email for the author of the request (R-73)', async () => {
    await serviceWith({}).commentAddedTo(aComment);

    expect(queue.jobs).toEqual([
      {
        kind: 'comment_on_my_request',
        requestId: aComment.requestId,
        requestTitle: 'Dark mode',
        recipientId: author,
        commenterName: 'Sam',
      },
    ]);
  });

  it('tells nobody about their own comment (R-71)', async () => {
    await serviceWith({}).commentAddedTo({ ...aComment, commenterId: author });

    expect(queue.jobs).toHaveLength(0);
  });

  it('tells nobody about their own status change (R-71)', async () => {
    await serviceWith({}).requestStatusChanged({
      requestId: aComment.requestId,
      requestTitle: 'Dark mode',
      authorId: author,
      actorId: author,
      newStatusName: 'Planned',
    });

    expect(queue.jobs).toHaveLength(0);
  });

  it('respects the switch the person turned off, per event (R-71)', async () => {
    const service = serviceWith({ notifyOnComment: false, notifyOnStatusChange: true });

    await service.commentAddedTo(aComment);
    await service.requestStatusChanged({
      requestId: aComment.requestId,
      requestTitle: 'Dark mode',
      authorId: author,
      actorId: someoneElse,
      newStatusName: 'Planned',
    });

    expect(queue.jobs.map((job) => job.kind)).toEqual(['status_changed_on_my_request']);
  });

  it('sends an invitation without asking about preferences (R-126)', async () => {
    // An invited person has no account yet, so there is nothing to ask.
    const service = new NotificationsService(
      queue,
      {
        settingsFor: (): Promise<MySettingsView> =>
          Promise.reject(new Error('there is no such user')),
      } as unknown as SettingsService,
      silentLogger,
    );

    await service.invitationCreated('newcomer@example.com', 'https://app.test/sign-up');

    expect(queue.jobs).toEqual([
      {
        kind: 'invitation',
        email: 'newcomer@example.com',
        signUpUrl: 'https://app.test/sign-up',
      },
    ]);
  });

  /**
   * R-72 and R-116. This is the reason the service swallows: the caller is in
   * the middle of finishing someone's comment, and a dead queue must not turn
   * that into a failed comment.
   */
  it('does not throw when the queue is unreachable', async () => {
    queue.failOnEnqueue = true;

    await expect(serviceWith({}).commentAddedTo(aComment)).resolves.toBeUndefined();
    await expect(
      serviceWith({}).invitationCreated('newcomer@example.com', 'https://app.test/sign-up'),
    ).resolves.toBeUndefined();
  });

  it('does not throw when the settings lookup fails', async () => {
    const service = new NotificationsService(
      queue,
      {
        settingsFor: (): Promise<MySettingsView> => Promise.reject(new Error('database is down')),
      } as unknown as SettingsService,
      silentLogger,
    );

    await expect(service.commentAddedTo(aComment)).resolves.toBeUndefined();
    expect(queue.jobs).toHaveLength(0);
  });

  it('carries no email address in the job (R-99)', async () => {
    await serviceWith({}).commentAddedTo(aComment);

    // The address is looked up at send time. A job may sit in Redis for a while,
    // so it must hold nothing private at rest.
    expect(JSON.stringify(queue.jobs)).not.toContain('@');
  });
});

describe('writing the message (R-57)', () => {
  const commentJob: NotificationJob = {
    kind: 'comment_on_my_request',
    requestId: 'r-1',
    requestTitle: 'Dark mode',
    recipientId: author,
    commenterName: 'Sam',
  };

  it('writes in English', () => {
    const email = renderNotification(
      commentJob,
      { email: 'person@example.com', language: 'en' },
      'https://app.test',
    );

    expect(email.to).toBe('person@example.com');
    expect(email.subject).toBe('New comment on "Dark mode"');
    expect(email.body).toContain('https://app.test/requests/r-1');
  });

  it('writes in Arabic when that is their language', () => {
    const email = renderNotification(
      commentJob,
      { email: 'person@example.com', language: 'ar' },
      'https://app.test',
    );

    expect(email.subject).toContain('تعليق جديد');
    expect(email.body).toContain('https://app.test/requests/r-1');
  });

  it('falls back to English for a language we do not have, never to a code word', () => {
    const email = renderNotification(
      commentJob,
      { email: 'person@example.com', language: 'de' },
      'https://app.test',
    );

    expect(email.subject).toBe('New comment on "Dark mode"');
  });

  it('sends an invitation to the invited address, which has no account', () => {
    const email = renderNotification(
      { kind: 'invitation', email: 'newcomer@example.com', signUpUrl: 'https://app.test/sign-up' },
      { email: 'newcomer@example.com', language: 'en' },
      'https://app.test',
    );

    expect(email.to).toBe('newcomer@example.com');
    expect(email.body).toContain('https://app.test/sign-up');
  });

  it('puts what a person typed in as plain text, never as markup (R-98)', () => {
    const email = renderNotification(
      { ...commentJob, requestTitle: '<script>alert(1)</script>' },
      { email: 'person@example.com', language: 'en' },
      'https://app.test',
    );

    // The body is plain text, so the tag is characters and not something a mail
    // client can run. What matters is that nothing escapes it into markup.
    expect(email.body).toContain('<script>alert(1)</script>');
    expect(email.body).not.toContain('<html');
  });
});

describe('the worker delivering one job', () => {
  let mail: FakeMailSender;

  beforeEach(() => {
    mail = new FakeMailSender();
  });

  const environment = { appBaseUrl: 'https://app.test' } as AppEnvironmentToken;

  const identityReturning = (user: Partial<UserView>): IdentityService =>
    ({
      findActiveUser: (): Promise<UserView> =>
        Promise.resolve({
          id: author,
          displayName: 'A Person',
          avatarUrl: null,
          role: 'user',
          email: 'person@example.com',
          isActive: true,
          ...user,
        }),
    }) as unknown as IdentityService;

  const deliverWith = (user: Partial<UserView>, language: 'en' | 'ar' = 'en'): DeliverNotification =>
    new DeliverNotification(
      mail,
      identityReturning(user),
      settingsServiceReturning({ language }),
      environment,
      silentLogger,
    );

  const commentJob: NotificationJob = {
    kind: 'comment_on_my_request',
    requestId: 'r-1',
    requestTitle: 'Dark mode',
    recipientId: author,
    commenterName: 'Sam',
  };

  it('looks the address up now, not when the job was written', async () => {
    await deliverWith({ email: 'moved@example.com' }).execute(commentJob);

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe('moved@example.com');
  });

  it('uses the language they had chosen when it is sent', async () => {
    await deliverWith({}, 'ar').execute(commentJob);

    expect(mail.sent[0]?.subject).toContain('تعليق جديد');
  });

  /** R-61: they may have deleted their account after the job was queued. */
  it('sends nothing to an account that has since been deleted', async () => {
    await deliverWith({ isActive: false }).execute(commentJob);

    expect(mail.sent).toHaveLength(0);
  });

  it('needs no account for an invitation (R-126)', async () => {
    const deliver = new DeliverNotification(
      mail,
      {
        findActiveUser: (): Promise<UserView> => Promise.reject(new Error('there is no such user')),
      } as unknown as IdentityService,
      settingsServiceReturning({}),
      environment,
      silentLogger,
    );

    await deliver.execute({
      kind: 'invitation',
      email: 'newcomer@example.com',
      signUpUrl: 'https://app.test/sign-up',
    });

    expect(mail.sent[0]?.to).toBe('newcomer@example.com');
  });

  /** R-127: logged and dropped. No retry, no record, and nothing thrown. */
  it('drops a failed send instead of throwing or retrying', async () => {
    mail.failOnSend = true;

    await expect(deliverWith({}).execute(commentJob)).resolves.toBeUndefined();
    expect(mail.sent).toHaveLength(0);
  });

  it('drops the job when the lookup itself fails', async () => {
    const deliver = new DeliverNotification(
      mail,
      {
        findActiveUser: (): Promise<UserView> => Promise.reject(new Error('database is down')),
      } as unknown as IdentityService,
      settingsServiceReturning({}),
      environment,
      silentLogger,
    );

    await expect(deliver.execute(commentJob)).resolves.toBeUndefined();
    expect(mail.sent).toHaveLength(0);
  });
});

/**
 * The SMTP end. There is no server here: `MAIL_ENABLED=false` is the developer
 * default, and the failure case points at a closed port on this machine, which
 * is refused immediately. So this stays a unit test — it never reaches a network.
 */
describe('the SMTP sender', () => {
  const environmentFor = (mail: Record<string, unknown>): AppEnvironmentToken =>
    ({
      mail: {
        host: '127.0.0.1',
        port: 1,
        user: undefined,
        password: undefined,
        from: 'FeedbackHub <no-reply@feedbackhub.test>',
        timeoutSeconds: 1,
        enabled: false,
        ...mail,
      },
    }) as unknown as AppEnvironmentToken;

  const anEmail: OutgoingEmail = {
    to: 'person@example.com',
    subject: 'New comment on "Dark mode"',
    body: 'Sam commented on your request.',
  };

  it('sends nothing from a developer machine, and says so in the log', async () => {
    const lines: { meta: Record<string, unknown>; message: string }[] = [];
    const logger = {
      debug: (): void => undefined,
      info: (meta: Record<string, unknown>, message: string): void => {
        lines.push({ meta, message });
      },
      warn: (): void => undefined,
      error: (): void => undefined,
    } as unknown as Logger;

    await new SmtpMailSender(environmentFor({ enabled: false }), logger).send(anEmail);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.message).toContain('not sending');
  });

  /** R-127: logged and dropped, with nothing thrown and no retry. */
  it('drops a send it cannot make, and keeps the address out of the log (R-99)', async () => {
    const lines: { meta: Record<string, unknown> }[] = [];
    const logger = {
      debug: (): void => undefined,
      info: (): void => undefined,
      warn: (): void => undefined,
      error: (meta: Record<string, unknown>): void => {
        lines.push({ meta });
      },
    } as unknown as Logger;

    await expect(
      new SmtpMailSender(environmentFor({ enabled: true }), logger).send(anEmail),
    ).resolves.toBeUndefined();

    expect(lines).toHaveLength(1);
    expect(JSON.stringify(lines[0]?.meta)).not.toContain('person@example.com');
  });
});
