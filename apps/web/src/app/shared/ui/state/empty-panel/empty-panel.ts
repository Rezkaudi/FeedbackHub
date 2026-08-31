import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fh-empty-panel',
  templateUrl: './empty-panel.html',
  styleUrl: './empty-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyPanel {
  public readonly heading = input.required<string>();
  public readonly detail = input<string>('');
}
