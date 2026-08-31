import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'fh-switch',
  imports: [Icon],
  templateUrl: './switch.html',
  styleUrl: './switch.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Switch {
  public readonly checked = input.required<boolean>();
  public readonly inputId = input<string>('');
  public readonly disabled = input<boolean>(false);
  public readonly toggled = output<void>();
}
