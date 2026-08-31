import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'search'
  | 'close'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'plus'
  | 'trash'
  | 'pencil'
  | 'more-vertical'
  | 'pin'
  | 'arrow-up'
  | 'message-circle'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'globe'
  | 'log-out'
  | 'user'
  | 'alert-circle'
  | 'check-circle'
  | 'arrow-left'
  | 'filter'
  | 'grid'
  | 'info'
  | 'mail'
  | 'arrow-up-down';

@Component({
  selector: 'fh-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'presentation', 'aria-hidden': 'true' },
})
export class Icon {
  public readonly name = input.required<IconName>();
  public readonly size = input<number>(20);
}
