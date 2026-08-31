import { ChangeDetectionStrategy, Component, inject, input, linkedSignal } from '@angular/core';
import { SettingsStore, type ProfileDraft } from '../../settings.store';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Field } from '../../../../shared/ui/field/field';
import { Button } from '../../../../shared/ui/button/button';
import { SectionCard } from '../../../../shared/ui/section-card/section-card';

@Component({
  selector: 'fh-profile-form',
  imports: [TranslatePipe, Field, Button, SectionCard],
  templateUrl: './profile-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileForm {
  protected readonly store = inject(SettingsStore);

  public readonly initial = input.required<ProfileDraft>();

  protected readonly displayName = linkedSignal(() => this.initial().displayName);
  protected readonly avatarUrl = linkedSignal(() => this.initial().avatarUrl ?? '');

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await this.store.saveProfile({ displayName: this.displayName(), avatarUrl: this.avatarUrl() });
  }
}
