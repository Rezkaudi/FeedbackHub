import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fh-skeleton-rows',
  templateUrl: './skeleton-rows.html',
  styleUrl: './skeleton-rows.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonRows {
  public readonly count = input<number>(5);
  public readonly label = input<string>('Loading');
  protected rows = () => Array.from({ length: this.count() }, (_, index) => index);
}
