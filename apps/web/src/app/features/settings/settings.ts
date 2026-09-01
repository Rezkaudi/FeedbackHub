import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SettingsStore } from './settings.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { Session } from '../../core/auth/session';
import { I18nStore } from '../../core/i18n/i18n.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs/breadcrumbs';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { Icon, type IconName } from '../../shared/ui/icon/icon';
import { ProfileForm } from './components/profile-form/profile-form';
import { AccountForm } from './components/account-form/account-form';
import { DevicePreferencesForm } from './components/device-preferences-form/device-preferences-form';
import { DangerZone } from './components/danger-zone/danger-zone';

interface Section {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
}

@Component({
  selector: 'fh-settings',
  providers: [SettingsStore],
  imports: [
    TranslatePipe,
    RouterLink,
    Breadcrumbs,
    Avatar,
    Icon,
    ProfileForm,
    AccountForm,
    DevicePreferencesForm,
    DangerZone,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly store = inject(SettingsStore);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly crumbs = computed(() => [
    { label: this.i18n.translate('nav.requests'), link: '/' },
    { label: this.i18n.translate('nav.settings') },
  ]);

  /** The in-page nav: one link per section card on the page. */
  protected readonly sections = computed<readonly Section[]>(() => [
    { id: 'profile', label: this.i18n.translate('settings.profileHeading'), icon: 'user' },
    { id: 'account', label: this.i18n.translate('settings.accountHeading'), icon: 'mail' },
    { id: 'device', label: this.i18n.translate('settings.deviceHeading'), icon: 'monitor' },
    { id: 'danger', label: this.i18n.translate('settings.dangerHeading'), icon: 'trash' },
  ]);

  /** Which section is under the reader right now, so the nav can mark it. */
  protected readonly activeSection = signal<string>('profile');

  constructor() {
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.activeSection.set(entry.target.id);
            }
          }
        },
        // A thin band near the top of the viewport is the "you are here" zone.
        { rootMargin: '-15% 0px -75% 0px' },
      );

      for (const section of this.sections()) {
        const element = document.getElementById(section.id);
        if (element) {
          observer.observe(element);
        }
      }

      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly displayName = computed(() => this.bootstrap.user()?.displayName ?? '');
  protected readonly avatarUrl = computed(() => this.bootstrap.user()?.avatarUrl ?? null);
  protected readonly isAdmin = computed(() => this.bootstrap.user()?.role === 'admin');

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
