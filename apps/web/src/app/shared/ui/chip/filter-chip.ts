import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'fh-filter-chip',
  imports: [Icon],
  templateUrl: './filter-chip.html',
  styleUrl: './filter-chip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterChip {
  public readonly checked = input.required<boolean>();
  public readonly inputId = input.required<string>();
  public readonly testId = input<string | undefined>(undefined);
  public readonly toggled = output<void>();
}
