import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../../icon/icon';
import { Button } from '../../button/button';

@Component({
  selector: 'fh-error-panel',
  imports: [Icon, Button],
  templateUrl: './error-panel.html',
  styleUrl: './error-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPanel {
  public readonly heading = input<string>('Something went wrong');
  public readonly detail = input<string>('');
  public readonly requestId = input<string>('');
  public readonly requestIdHint = input<string>('Quote this id if you ask for help:');
  public readonly canRetry = input<boolean>(true);
  public readonly retryLabel = input<string>('Try again');
  public readonly retry = output<void>();
}
