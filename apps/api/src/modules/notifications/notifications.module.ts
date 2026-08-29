import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MAIL_SENDER, NOTIFICATION_QUEUE } from './application/port/notification-ports';
import { RedisNotificationQueue } from './infrastructure/queue/redis-notification-queue';
import { SmtpMailSender } from './infrastructure/mail/smtp-mail-sender';
import { DeliverNotification } from './application/use-case/deliver-notification';
import { SettingsModule } from '../settings/settings.module';
import { IdentityModule } from '../identity/identity.module';

/**
 * Owns no table. It owns the queue and the SMTP connection (R-140).
 *
 * This is the module the SRS names as the first one we would extract into its
 * own service if the app grew, because it holds no shared invariant (8.4).
 */
@Module({
  imports: [SettingsModule, forwardRef(() => IdentityModule)],
  providers: [
    { provide: NOTIFICATION_QUEUE, useClass: RedisNotificationQueue },
    { provide: MAIL_SENDER, useClass: SmtpMailSender },
    DeliverNotification,
    NotificationsService,
  ],
  exports: [NotificationsService, DeliverNotification, NOTIFICATION_QUEUE],
})
export class NotificationsModule {}
