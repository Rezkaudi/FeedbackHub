import { Inject, Injectable } from '@nestjs/common';
import { MAIL_SENDER, MailSender } from '../port/notification-ports';
import { NotificationJob } from '../../domain/entity/notification-job';
import { renderNotification } from '../render/messages';
import { IdentityService } from '../../../identity/identity.service';
import { SettingsService } from '../../../settings/settings.service';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from '../../../../shared/config/environment.token';
import { Logger } from '../../../../shared/logging/logger';

/**
 * What the worker does with one job (R-144). It runs in a separate process from
 * the same image, so nothing here may assume an HTTP request.
 *
 * The recipient's address and language are looked up **now**, not carried in the
 * job: the job may have waited, and the address is private data that should not
 * sit in a queue (R-99, R-119).
 */
@Injectable()
export class DeliverNotification {
  public constructor(
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    private readonly identity: IdentityService,
    private readonly settings: SettingsService,
    @Inject(APP_ENVIRONMENT) private readonly environment: AppEnvironmentToken,
    private readonly logger: Logger,
  ) {}

  public async execute(job: NotificationJob): Promise<void> {
    try {
      const recipient = await this.recipientFor(job);

      if (recipient === null) {
        return;
      }

      await this.mail.send(renderNotification(job, recipient, this.environment.appBaseUrl));
    } catch (error) {
      // R-127: logged and dropped. No retry, no record.
      this.logger.error({ err: error, kind: job.kind }, 'A notification was dropped');
    }
  }

  private async recipientFor(
    job: NotificationJob,
  ): Promise<{ email: string; language: string } | null> {
    // R-126: the invited person has no account and no settings yet.
    if (job.kind === 'invitation') {
      return { email: job.email, language: 'en' };
    }

    const user = await this.identity.findActiveUser(job.recipientId);
    const settings = await this.settings.settingsFor(job.recipientId);

    // They may have deleted their account since the job was queued (R-61).
    if (!user.isActive) {
      return null;
    }

    return { email: user.email, language: settings.language };
  }
}
