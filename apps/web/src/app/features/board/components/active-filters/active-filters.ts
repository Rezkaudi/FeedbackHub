import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { Category, Status } from '../../../../core/bootstrap/bootstrap.store';

interface ActiveFilterTag {
  readonly label: string;
  readonly remove: () => void;
}

@Component({
  selector: 'fh-active-filters',
  imports: [Icon, TranslatePipe],
  templateUrl: './active-filters.html',
  styleUrl: './active-filters.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveFilters {
  public readonly search = input.required<string>();
  public readonly selectedStatuses = input.required<readonly Status[]>();
  public readonly selectedCategories = input.required<readonly Category[]>();

  public readonly searchCleared = output<void>();
  public readonly statusRemoved = output<string>();
  public readonly categoryRemoved = output<string>();
  public readonly clearedAll = output<void>();

  protected readonly tags = computed<readonly ActiveFilterTag[]>(() => {
    const tags: ActiveFilterTag[] = [];

    if (this.search().length > 0) {
      tags.push({ label: this.search(), remove: () => this.searchCleared.emit() });
    }
    for (const status of this.selectedStatuses()) {
      tags.push({ label: status.name, remove: () => this.statusRemoved.emit(status.id) });
    }
    for (const category of this.selectedCategories()) {
      tags.push({ label: category.name, remove: () => this.categoryRemoved.emit(category.id) });
    }

    return tags;
  });
}
