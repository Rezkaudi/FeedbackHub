import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fh-spinner',
  templateUrl: './spinner.html',
  styleUrl: './spinner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'presentation', 'aria-hidden': 'true' },
})
export class Spinner {
  public readonly size = input<number>(20);
}
