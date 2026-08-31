import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { Field } from '../../../../../shared/ui/field/field';
import { Button } from '../../../../../shared/ui/button/button';

@Component({
  selector: 'fh-taxonomy-form',
  imports: [TranslatePipe, Field, Button],
  templateUrl: './taxonomy-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomyForm {
  public readonly label = input.required<string>();
  public readonly nameId = input.required<string>();
  public readonly colorId = input.required<string>();
  public readonly saving = input<boolean>(false);

  public readonly created = output<{ name: string; color: string }>();

  protected readonly name = signal('');
  protected readonly color = signal('#0b57d0');

  protected submit(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (name.length === 0) {
      return;
    }
    this.created.emit({ name, color: this.color() });
    this.name.set('');
  }
}
