import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fh-taxonomy-chip',
  templateUrl: './taxonomy-chip.html',
  styleUrl: './taxonomy-chip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomyChip {
  public readonly name = input.required<string>();
  public readonly color = input.required<string>();
  public readonly isActive = input<boolean>(true);
  public readonly retiredLabel = input<string>('retired');
}
