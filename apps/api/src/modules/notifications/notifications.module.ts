import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MAIL_SENDER, NOTIFICATION_QUEUE } from './application/port/notification-ports';
import { RedisNotificationQueue } from './infrastructure/queue/redis-notification-queue';
import { SmtpMailSender } from './infrastructure/mail/smtp-mail-sender';
import { DeliverNotification } from './application/use-case/deliver-notification';
import { SettingsModule } from '../settings/settings.module';

/**
 * Owns no table. It owns the queue and the SMTP connection (R-140).
 *
 * This is the module the SRS names as the first one we would extract into its
 * own service if the app grew, because it holds no shared invariant (8.4).
 *
 * `DeliverNotification` injects `IdentityService`, but this module does not
 * import `IdentityModule` to get it: `IdentityModule` is `@Global()` (see its
 * own doc comment — it already has to dodge one cycle with `invitations`
 * this way), so its exports reach every module without an explicit import.
 * Importing it here too — even behind `forwardRef` — re-creates a *static*
 * import cycle (identity -> invitations -> notifications -> identity) that
 * `forwardRef` only ever fixed at the DI-instantiation level, not in the
 * plain `import` graph, and `depcruise`'s `no-circular` rule (rightly) still
 * flags that.
 */
@Module({
  imports: [SettingsModule],
  providers: [
    { provide: NOTIFICATION_QUEUE, useClass: RedisNotificationQueue },
    { provide: MAIL_SENDER, useClass: SmtpMailSender },
    DeliverNotification,
    NotificationsService,
  ],
  exports: [NotificationsService, DeliverNotification, NOTIFICATION_QUEUE],
})
export class NotificationsModule {}
