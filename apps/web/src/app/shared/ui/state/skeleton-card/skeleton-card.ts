import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A loading placeholder shaped like an `fh-section-card`: a header block over a
 * short list of rows. Use it on the settings-style screens so the loading state
 * matches the layout that follows it, not the board's card grid.
 */
@Component({
  selector: 'fh-skeleton-card',
  templateUrl: './skeleton-card.html',
  styleUrl: './skeleton-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonCard {
  /** How many cards to render. */
  public readonly cards = input<number>(1);
  /** How many rows inside each card. */
  public readonly rows = input<number>(4);
  public readonly label = input<string>('Loading');

  protected list = (count: number) => Array.from({ length: count }, (_, index) => index);
}
