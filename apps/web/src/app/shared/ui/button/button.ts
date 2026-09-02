import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, type IconName } from '../icon/icon';
import { Spinner } from '../spinner/spinner';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger' | 'danger-text';
export type ButtonSize = 'md' | 'sm';

@Component({
  selector: 'fh-button',
  imports: [Icon, Spinner],
  templateUrl: './button.html',
  styleUrl: './button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  public readonly variant = input<ButtonVariant>('filled');
  public readonly size = input<ButtonSize>('md');
  public readonly icon = input<IconName | undefined>(undefined);
  public readonly loading = input<boolean>(false);
  public readonly disabled = input<boolean>(false);
  public readonly type = input<'button' | 'submit'>('button');
  public readonly testId = input<string | undefined>(undefined);
}
