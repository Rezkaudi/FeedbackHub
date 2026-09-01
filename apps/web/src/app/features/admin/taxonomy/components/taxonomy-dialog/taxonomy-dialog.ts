import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { Field } from '../../../../../shared/ui/field/field';
import { Button } from '../../../../../shared/ui/button/button';
import { Dialog } from '../../../../../shared/ui/dialog/dialog';

/**
 * The "add a category" / "add a status" popup. One name field and a colour, in
 * a modal opened from the card's top-right button.
 */
@Component({
  selector: 'fh-taxonomy-dialog',
  imports: [TranslatePipe, Field, Button, Dialog],
  templateUrl: './taxonomy-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomyDialog {
  public readonly open = input.required<boolean>();
  /** Dialog heading, e.g. "Add a category". */
  public readonly heading = input.required<string>();
  /** Submit button text, e.g. "Add category". */
  public readonly submitLabel = input.required<string>();
  public readonly nameId = input.required<string>();
  public readonly colorId = input.required<string>();
  public readonly saving = input<boolean>(false);

  public readonly created = output<{ name: string; color: string }>();
  public readonly closed = output<void>();

  protected readonly name = signal('');
  protected readonly color = signal('#0b57d0');

  public constructor() {
    // Start every fresh open from a clean form.
    effect(() => {
      if (this.open()) {
        this.name.set('');
        this.color.set('#0b57d0');
      }
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (name.length === 0) {
      return;
    }
    this.created.emit({ name, color: this.color() });
  }
}
