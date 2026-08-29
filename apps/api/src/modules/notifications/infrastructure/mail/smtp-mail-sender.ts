import { Inject, Injectable } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { MailSender, OutgoingEmail } from '../../application/port/notification-ports';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from '../../../../shared/config/environment.token';
import { Logger } from '../../../../shared/logging/logger';

/**
 * R-73: the email is really sent, over SMTP.
 * R-128: every setting comes from the environment, including the timeout —
 *        nodemailer's own default is measured in minutes, which would hang the
 *        worker on an unreachable server.
 * R-127: a failure is logged and dropped. No retry, no record. The README says
 *        so plainly, because the worst case is a lost invitation and the admin
 *        needs to know to resend it by hand.
 */
@Injectable()
export class SmtpMailSender implements MailSender {
  private readonly transport: Transporter;

  public constructor(
    @Inject(APP_ENVIRONMENT) private readonly environment: AppEnvironmentToken,
    private readonly logger: Logger,
  ) {
    const timeout = environment.mail.timeoutSeconds * 1000;

    this.transport = createTransport({
      host: environment.mail.host,
      port: environment.mail.port,
      secure: false,
      auth:
        environment.mail.user !== undefined && environment.mail.user.length > 0
          ? { user: environment.mail.user, pass: environment.mail.password }
          : undefined,
      connectionTimeout: timeout,
      greetingTimeout: timeout,
      socketTimeout: timeout,
    });
  }

  public async send(email: OutgoingEmail): Promise<void> {
    // MAIL_ENABLED off in development: the message goes to the log instead of
    // the wire, so nothing real is sent from a developer's machine.
    if (!this.environment.mail.enabled) {
      this.logger.info({ subject: email.subject }, 'Mail is switched off; not sending');
      return;
    }

    try {
      await this.transport.sendMail({
        from: this.environment.mail.from,
        to: email.to,
        subject: email.subject,
        text: email.body,
      });
    } catch (error) {
      // Logged without the address: an email address is a person's private data
      // and does not belong in a log (R-119, R-99).
      this.logger.error({ err: error, subject: email.subject }, 'An email could not be sent');
    }
  }
}
