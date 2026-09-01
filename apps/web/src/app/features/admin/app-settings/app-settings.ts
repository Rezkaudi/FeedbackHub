import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminStore, type AppSettings as AppSettingsShape } from '../admin.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ApiErrorPipe } from '../../../core/error/api-error.pipe';
import { ErrorPanel } from '../../../shared/ui/state/error-panel/error-panel';
import { SkeletonCard } from '../../../shared/ui/state/skeleton-card/skeleton-card';
import {
  RegistrationCard,
  type RegistrationChange,
} from './components/registration-card/registration-card';
import { CommentsCard } from './components/comments-card/comments-card';
import { RateLimitsCard } from './components/rate-limits-card/rate-limits-card';

/**
 * The comment switches and rate limits save the moment they change (R-69: no
 * restart, takes effect at once) — no "Saved" banner; a change that failed
 * shows the old value with a message (SRS 15.7). The registration policy also
 * saves on change, except "domain restricted": that needs a domain in the same
 * save (R-67), so the domains field has its own Save button and emits both.
 */
@Component({
  selector: 'fh-app-settings',
  imports: [TranslatePipe, ApiErrorPipe, ErrorPanel, SkeletonCard, RegistrationCard, CommentsCard, RateLimitsCard],
  templateUrl: './app-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSettings {
  protected readonly admin = inject(AdminStore);

  public constructor() {
    void this.admin.loadSettings();
  }

  protected onRegistration(change: RegistrationChange): void {
    const patch: Partial<AppSettingsShape> = { registrationPolicy: change.registrationPolicy };
    if (change.allowedEmailDomains !== undefined) {
      patch.allowedEmailDomains = [...change.allowedEmailDomains];
    }
    void this.admin.saveSettings(patch);
  }

  protected onCommentsEnabled(featureCommentsEnabled: boolean): void {
    void this.admin.saveSettings({ featureCommentsEnabled });
  }

  protected onCommentsApproval(commentsRequireApproval: boolean): void {
    void this.admin.saveSettings({ commentsRequireApproval });
  }

  protected onLimit(change: { field: string; value: number }): void {
    void this.admin.saveSettings({ [change.field]: change.value });
  }
}
