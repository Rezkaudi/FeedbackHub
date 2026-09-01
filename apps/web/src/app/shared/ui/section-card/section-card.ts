import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, type IconName } from '../icon/icon';

@Component({
  selector: 'fh-section-card',
  imports: [Icon],
  templateUrl: './section-card.html',
  styleUrl: './section-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionCard {
  public readonly heading = input.required<string>();
  public readonly detail = input<string>('');
  public readonly headingId = input<string>('');
  /** Optional glyph shown beside the heading. */
  public readonly icon = input<IconName | undefined>(undefined);
  /** Tone of the card. `danger` paints the frame and heading in the error role. */
  public readonly tone = input<'default' | 'danger'>('default');
}
