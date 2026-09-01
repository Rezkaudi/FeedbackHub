import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { SettingsStore, type ProfileDraft } from '../../settings.store';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiErrorPipe } from '../../../../core/error/api-error.pipe';
import { Field } from '../../../../shared/ui/field/field';
import { Button } from '../../../../shared/ui/button/button';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { SectionCard } from '../../../../shared/ui/section-card/section-card';

@Component({
  selector: 'fh-profile-form',
  imports: [TranslatePipe, ApiErrorPipe, Field, Button, Icon, Avatar, SectionCard],
  templateUrl: './profile-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileForm {
  protected readonly store = inject(SettingsStore);

  public readonly initial = input.required<ProfileDraft>();

  protected readonly displayName = linkedSignal(() => this.initial().displayName);
  protected readonly avatarUrl = linkedSignal(() => this.initial().avatarUrl ?? '');

  protected readonly isEmpty = computed(() => this.displayName().trim().length === 0);

  /** What the avatar shows while typing — an emptied box falls back to initials. */
  protected readonly previewUrl = computed(() => {
    const value = this.avatarUrl().trim();
    return value === '' ? null : value;
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await this.store.saveProfile({ displayName: this.displayName(), avatarUrl: this.avatarUrl() });
  }
}
