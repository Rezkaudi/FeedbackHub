import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BootstrapStore } from '../../../core/bootstrap/bootstrap.store';
import { Session } from '../../../core/auth/session';
import { DevicePreferencesStore, type Theme } from '../../../core/config/device-preferences.store';
import { I18nStore, type Language } from '../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Menu } from '../../../shared/ui/menu/menu';
import { MenuItem } from '../../../shared/ui/menu/menu-item';
import { SegmentedControl, type SegmentedOption } from '../../../shared/ui/segmented-control/segmented-control';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'fh-user-menu',
  imports: [Menu, MenuItem, SegmentedControl, Avatar, Icon, TranslatePipe],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenu {
  protected readonly bootstrap = inject(BootstrapStore);
  protected readonly i18n = inject(I18nStore);
  protected readonly preferences = inject(DevicePreferencesStore);
  private readonly session = inject(Session);

  protected readonly themeOptions = computed<readonly SegmentedOption<Theme>[]>(() => [
    { value: 'system', label: this.i18n.translate('header.themeSystem'), icon: 'monitor' },
    { value: 'light', label: this.i18n.translate('header.themeLight'), icon: 'sun' },
    { value: 'dark', label: this.i18n.translate('header.themeDark'), icon: 'moon' },
  ]);

  protected readonly languageOptions = computed<readonly SegmentedOption<Language>[]>(() => [
    { value: 'en', label: 'EN', srLabel: this.i18n.translate('header.languageEnglish') },
    { value: 'ar', label: 'AR', srLabel: this.i18n.translate('header.languageArabic') },
  ]);

  protected chooseTheme(theme: Theme): void {
    this.preferences.setTheme(theme);
  }

  protected chooseLanguage(language: Language): void {
    this.i18n.setLanguage(language);
  }

  protected signOut(): void {
    void this.session.signOut();
  }
}
