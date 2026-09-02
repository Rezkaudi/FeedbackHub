import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, type IconName } from '../icon/icon';
import { Spinner } from '../spinner/spinner';

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'danger';

@Component({
  selector: 'fh-icon-button',
  imports: [Icon, Spinner],
  templateUrl: './icon-button.html',
  styleUrl: './icon-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconButton {
  public readonly icon = input.required<IconName>();
  public readonly label = input.required<string>();
  public readonly variant = input<IconButtonVariant>('standard');
  public readonly loading = input<boolean>(false);
  public readonly disabled = input<boolean>(false);
  public readonly pressed = input<boolean | undefined>(undefined);
  public readonly type = input<'button' | 'submit'>('button');
  public readonly hasPopup = input<'menu' | 'dialog' | undefined>(undefined);
  public readonly expanded = input<boolean | undefined>(undefined);
  public readonly testId = input<string | undefined>(undefined);
}
