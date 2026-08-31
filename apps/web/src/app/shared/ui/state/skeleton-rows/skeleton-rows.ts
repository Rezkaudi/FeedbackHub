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

  /** 'grid' fans cards out in 1–3 columns (the board); 'stack' keeps one full-width column. */
  public readonly layout = input<'grid' | 'stack'>('grid');
  protected rows = () => Array.from({ length: this.count() }, (_, index) => index);
}
