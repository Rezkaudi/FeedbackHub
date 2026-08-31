import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fh-section-card',
  templateUrl: './section-card.html',
  styleUrl: './section-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionCard {
  public readonly heading = input.required<string>();
  public readonly detail = input<string>('');
  public readonly headingId = input<string>('');
}
