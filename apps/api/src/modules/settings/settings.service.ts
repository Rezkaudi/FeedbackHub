import { Injectable } from '@nestjs/common';
import { ReadAppSettings } from './application/use-case/read-app-settings';
import { ReadUserSettings } from './application/use-case/read-user-settings';
import { AppSettingsView, MySettingsView } from './contract';

/**
 * The published service of this module (R-141). Other modules ask it; they never
 * read `app_settings` or `user_settings` themselves.
 *
 * Who calls it, and why:
 *   comments      — is the comments switch on (R-42), and does a new comment
 *                   need approval (R-40)?
 *   requests/votes/identity — what are the three rate limits (R-130)?
 *   identity      — what is the sign-up rule (R-67)?
 *   notifications — what language, and did this person ask for this email (R-71)?
 *   bootstrap     — the switches for the start-up call (R-52).
 */
@Injectable()
export class SettingsService {
  public constructor(
    private readonly readAppSettings: ReadAppSettings,
    private readonly readUserSettings: ReadUserSettings,
  ) {}

  public async appSettings(): Promise<AppSettingsView> {
    const settings = await this.readAppSettings.execute();

    return {
      registrationPolicy: settings.registrationPolicy,
      allowedEmailDomains: settings.allowedEmailDomains,
      commentsRequireApproval: settings.commentsRequireApproval,
      featureCommentsEnabled: settings.featureCommentsEnabled,
      signupLimit: settings.signupLimit,
      submissionLimit: settings.submissionLimit,
      voteLimit: settings.voteLimit,
    };
  }

  /** R-42. Named rather than boolean-flagged, so a call site reads as the rule. */
  public async commentsAreEnabled(): Promise<boolean> {
    return (await this.appSettings()).featureCommentsEnabled;
  }

  public async commentsNeedApproval(): Promise<boolean> {
    return (await this.appSettings()).commentsRequireApproval;
  }

  public async settingsFor(userId: string): Promise<MySettingsView> {
    const settings = await this.readUserSettings.execute(userId);

    return {
      // Already resolved: code default, then the person (R-51).
      language: settings.language,
      notifyOnComment: settings.notifyOnComment,
      notifyOnStatusChange: settings.notifyOnStatusChange,
    };
  }
}
