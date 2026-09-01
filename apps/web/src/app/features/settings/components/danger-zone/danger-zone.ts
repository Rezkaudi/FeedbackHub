import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { SettingsStore } from '../../settings.store';
import { I18nStore } from '../../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Button } from '../../../../shared/ui/button/button';
import { SectionCard } from '../../../../shared/ui/section-card/section-card';
import { ConfirmService } from '../../../../shared/ui/dialog/confirm.service';

@Component({
  selector: 'fh-danger-zone',
  imports: [TranslatePipe, Button, SectionCard],
  templateUrl: './danger-zone.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DangerZone {
  protected readonly store = inject(SettingsStore);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nStore);

  public readonly confirmedDelete = output<void>();

  protected async askToDelete(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('settings.dangerConfirmTitle'),
      message: this.i18n.translate('settings.dangerConfirmMessage'),
      confirmLabel: this.i18n.translate('settings.dangerConfirmAction'),
      tone: 'danger',
    });

    if (confirmed) {
      this.confirmedDelete.emit();
    }
  }
}
