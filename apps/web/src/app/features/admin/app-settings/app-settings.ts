import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminStore } from '../admin.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ErrorPanel } from '../../../shared/ui/state/error-panel/error-panel';
import { SkeletonRows } from '../../../shared/ui/state/skeleton-rows/skeleton-rows';
import { RegistrationCard, type RegistrationPolicy } from './components/registration-card/registration-card';
import { CommentsCard } from './components/comments-card/comments-card';
import { RateLimitsCard } from './components/rate-limits-card/rate-limits-card';

@Component({
  selector: 'fh-app-settings',
  imports: [TranslatePipe, ErrorPanel, SkeletonRows, RegistrationCard, CommentsCard, RateLimitsCard],
  templateUrl: './app-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSettings {
  protected readonly admin = inject(AdminStore);

  public constructor() {
    void this.admin.loadSettings();
  }

  protected onPolicy(policy: RegistrationPolicy): void {
    void this.admin.saveSettings({ registrationPolicy: policy });
  }

  protected onDomains(domains: readonly string[]): void {
    void this.admin.saveSettings({ allowedEmailDomains: [...domains] });
  }

  protected onCommentsEnabled(enabled: boolean): void {
    void this.admin.saveSettings({ featureCommentsEnabled: enabled });
  }

  protected onCommentsApproval(required: boolean): void {
    void this.admin.saveSettings({ commentsRequireApproval: required });
  }

  protected onLimit(change: { field: string; value: number }): void {
    void this.admin.saveSettings({ [change.field]: change.value });
  }
}
