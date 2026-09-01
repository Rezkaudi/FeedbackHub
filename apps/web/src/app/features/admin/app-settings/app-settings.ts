import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminStore } from '../admin.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ApiErrorPipe } from '../../../core/error/api-error.pipe';
import { ErrorPanel } from '../../../shared/ui/state/error-panel/error-panel';
import { SkeletonCard } from '../../../shared/ui/state/skeleton-card/skeleton-card';
import {
  RegistrationCard,
  type RegistrationPolicy,
} from './components/registration-card/registration-card';
import { CommentsCard } from './components/comments-card/comments-card';
import { RateLimitsCard } from './components/rate-limits-card/rate-limits-card';

/**
 * Each control saves itself the moment it changes (R-69: no restart, takes
 * effect at once). There is no Save button and no "Saved" banner — a change
 * that failed shows the old value with a message (SRS 15.7), a change that
 * worked just stays.
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

  protected onPolicy(registrationPolicy: RegistrationPolicy): void {
    void this.admin.saveSettings({ registrationPolicy });
  }

  protected onDomains(allowedEmailDomains: readonly string[]): void {
    void this.admin.saveSettings({ allowedEmailDomains: [...allowedEmailDomains] });
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
