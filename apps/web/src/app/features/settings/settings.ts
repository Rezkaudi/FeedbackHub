import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsStore } from './settings.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { Session } from '../../core/auth/session';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ProfileForm } from './components/profile-form/profile-form';
import { AccountForm } from './components/account-form/account-form';
import { DevicePreferencesForm } from './components/device-preferences-form/device-preferences-form';
import { DangerZone } from './components/danger-zone/danger-zone';

@Component({
  selector: 'fh-settings',
  providers: [SettingsStore],
  imports: [TranslatePipe, ProfileForm, AccountForm, DevicePreferencesForm, DangerZone],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly store = inject(SettingsStore);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  protected readonly profileInitial = computed(() => ({
    displayName: this.bootstrap.user()?.displayName ?? '',
    avatarUrl: this.bootstrap.user()?.avatarUrl ?? null,
  }));

  protected readonly accountInitial = computed(() => ({
    language: this.bootstrap.mySettings()?.language === 'ar' ? ('ar' as const) : ('en' as const),
    notifyOnComment: this.bootstrap.mySettings()?.notifyOnComment ?? true,
    notifyOnStatusChange: this.bootstrap.mySettings()?.notifyOnStatusChange ?? true,
  }));

  protected async onConfirmedDelete(): Promise<void> {
    if (await this.store.deleteAccount()) {
      this.session.signOut();
    } else {
      void this.router.navigate([], { queryParams: {} });
    }
  }
}
