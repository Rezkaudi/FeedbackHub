import { ChangeDetectionStrategy, Component, inject, input, linkedSignal } from '@angular/core';
import { SettingsStore, type SettingsDraft } from '../../settings.store';
import { DevicePreferencesStore } from '../../../../core/config/device-preferences.store';
import { I18nStore, type Language } from '../../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Field } from '../../../../shared/ui/field/field';
import { Button } from '../../../../shared/ui/button/button';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Switch } from '../../../../shared/ui/switch/switch';
import { SectionCard } from '../../../../shared/ui/section-card/section-card';
import { SegmentedControl, type SegmentedOption } from '../../../../shared/ui/segmented-control/segmented-control';

@Component({
  selector: 'fh-account-form',
  imports: [TranslatePipe, Field, Button, Icon, Switch, SectionCard, SegmentedControl],
  templateUrl: './account-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountForm {
  protected readonly store = inject(SettingsStore);
  private readonly preferences = inject(DevicePreferencesStore);
  private readonly i18n = inject(I18nStore);

  public readonly initial = input.required<SettingsDraft>();

  protected readonly languageOptions: readonly SegmentedOption<Language>[] = [
    { value: 'en', label: 'EN', srLabel: this.i18n.translate('header.languageEnglish') },
    { value: 'ar', label: 'AR', srLabel: this.i18n.translate('header.languageArabic') },
  ];

  protected readonly language = linkedSignal(() => this.initial().language);
  protected readonly notifyOnComment = linkedSignal(() => this.initial().notifyOnComment);
  protected readonly notifyOnStatusChange = linkedSignal(() => this.initial().notifyOnStatusChange);

  protected onLanguage(language: Language): void {
    this.language.set(language);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const saved = await this.store.saveSettings({
      language: this.language(),
      notifyOnComment: this.notifyOnComment(),
      notifyOnStatusChange: this.notifyOnStatusChange(),
    });

    if (saved !== null) {
      this.preferences.setStoredLanguage(saved.language);
    }
  }
}
