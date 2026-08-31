import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon, type IconName } from '../icon/icon';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  srLabel?: string;
}

@Component({
  selector: 'fh-segmented-control',
  imports: [Icon],
  templateUrl: './segmented-control.html',
  styleUrl: './segmented-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedControl<T extends string> {
  public readonly options = input.required<readonly SegmentedOption<T>[]>();
  public readonly value = input.required<T>();
  public readonly ariaLabel = input.required<string>();

  public readonly valueChange = output<T>();

  protected select(value: T): void {
    if (value !== this.value()) {
      this.valueChange.emit(value);
    }
  }
}
