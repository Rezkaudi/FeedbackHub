import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { Field } from '../../../../../shared/ui/field/field';
import { Button } from '../../../../../shared/ui/button/button';

@Component({
  selector: 'fh-invite-form',
  imports: [TranslatePipe, Field, Button],
  templateUrl: './invite-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteForm {
  public readonly invited = output<string>();

  protected readonly email = signal('');

  protected submit(event: Event): void {
    event.preventDefault();
    const value = this.email().trim();
    if (value.length === 0) {
      return;
    }
    this.invited.emit(value);
    this.email.set('');
  }
}
