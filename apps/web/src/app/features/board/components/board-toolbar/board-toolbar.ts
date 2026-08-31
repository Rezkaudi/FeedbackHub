import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Button } from '../../../../shared/ui/button/button';
import { Dialog } from '../../../../shared/ui/dialog/dialog';
import { BoardSearch } from '../board-search/board-search';
import { BoardSort } from '../board-sort/board-sort';
import { BoardFilters } from '../board-filters/board-filters';
import { ActiveFilters } from '../active-filters/active-filters';
import type { Category, Status } from '../../../../core/bootstrap/bootstrap.store';
import type { Sort } from '../../../../core/config/device-preferences.store';
import type { BoardQuery } from '../../board-query';

@Component({
  selector: 'fh-board-toolbar',
  imports: [TranslatePipe, Button, Dialog, BoardSearch, BoardSort, BoardFilters, ActiveFilters],
  templateUrl: './board-toolbar.html',
  styleUrl: './board-toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardToolbar {
  public readonly query = input.required<BoardQuery>();
  public readonly statuses = input.required<readonly Status[]>();
  public readonly categories = input.required<readonly Category[]>();

  public readonly searchChange = output<string>();
  public readonly sortChange = output<Sort>();
  public readonly statusToggled = output<string>();
  public readonly categoryToggled = output<string>();
  public readonly clearedAll = output<void>();
  public readonly newRequest = output<void>();

  protected readonly filtersOpen = signal(false);

  protected readonly activeCount = computed(
    () => this.query().statusIds.length + this.query().categoryIds.length,
  );

  protected readonly selectedStatuses = computed(() =>
    this.statuses().filter((status) => this.query().statusIds.includes(status.id)),
  );

  protected readonly selectedCategories = computed(() =>
    this.categories().filter((category) => this.query().categoryIds.includes(category.id)),
  );

  protected toggleFilters(): void {
    this.filtersOpen.update((value) => !value);
  }

  protected closeFilters(): void {
    this.filtersOpen.set(false);
  }
}
