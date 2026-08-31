import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fh-field',
  templateUrl: './field.html',
  styleUrl: './field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Field {
  public readonly label = input.required<string>();
  public readonly fieldId = input<string>('');
  public readonly hint = input<string>('');
  public readonly error = input<string>('');
  public readonly required = input<boolean>(false);
}
