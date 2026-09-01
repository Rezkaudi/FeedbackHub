import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DevicePreferencesStore, type Sort, type Theme } from '../../../../core/config/device-preferences.store';
import { BootstrapStore } from '../../../../core/bootstrap/bootstrap.store';
import { I18nStore } from '../../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Field } from '../../../../shared/ui/field/field';
import { FilterChip } from '../../../../shared/ui/chip/filter-chip';
import { SectionCard } from '../../../../shared/ui/section-card/section-card';
import { SegmentedControl, type SegmentedOption } from '../../../../shared/ui/segmented-control/segmented-control';

@Component({
  selector: 'fh-device-preferences-form',
  imports: [TranslatePipe, Field, FilterChip, SectionCard, SegmentedControl],
  templateUrl: './device-preferences-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicePreferencesForm {
  protected readonly preferences = inject(DevicePreferencesStore);
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly i18n = inject(I18nStore);

  protected readonly themeOptions = computed<readonly SegmentedOption<Theme>[]>(() => [
    { value: 'system', label: this.i18n.translate('header.themeSystem'), icon: 'monitor' },
    { value: 'light', label: this.i18n.translate('header.themeLight'), icon: 'sun' },
    { value: 'dark', label: this.i18n.translate('header.themeDark'), icon: 'moon' },
  ]);

  protected onTheme(theme: Theme): void {
    this.preferences.setTheme(theme);
  }

  protected onSort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'newest' || value === 'oldest' || value === 'most_votes' || value === 'most_comments') {
      this.preferences.setDefaultSort(value satisfies Sort);
    }
  }

  protected toggleCategory(id: string): void {
    const current = this.preferences.defaultCategoryIds();
    this.preferences.setDefaultCategoryIds(
      current.includes(id) ? current.filter((one) => one !== id) : [...current, id],
    );
  }

  protected toggleStatus(id: string): void {
    const current = this.preferences.defaultStatusIds();
    this.preferences.setDefaultStatusIds(
      current.includes(id) ? current.filter((one) => one !== id) : [...current, id],
    );
  }
}
