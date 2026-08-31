import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { FilterChip } from '../../../../shared/ui/chip/filter-chip';
import type { Category, Status } from '../../../../core/bootstrap/bootstrap.store';

@Component({
  selector: 'fh-board-filters',
  imports: [FilterChip, TranslatePipe],
  templateUrl: './board-filters.html',
  styleUrl: './board-filters.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardFilters {
  public readonly statuses = input.required<readonly Status[]>();
  public readonly categories = input.required<readonly Category[]>();
  public readonly statusIds = input.required<readonly string[]>();
  public readonly categoryIds = input.required<readonly string[]>();

  public readonly statusToggled = output<string>();
  public readonly categoryToggled = output<string>();
}
