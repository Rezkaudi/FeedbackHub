import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { Sort } from '../../../../core/config/device-preferences.store';
import type { TranslationKey } from '../../../../core/i18n/i18n.store';

const SORT_OPTIONS: ReadonlyArray<{ value: Sort; labelKey: TranslationKey }> = [
  { value: 'newest', labelKey: 'board.sortNewest' },
  { value: 'oldest', labelKey: 'board.sortOldest' },
  { value: 'most_votes', labelKey: 'board.sortMostVotes' },
  { value: 'most_comments', labelKey: 'board.sortMostComments' },
];

@Component({
  selector: 'fh-board-sort',
  imports: [TranslatePipe, Icon],
  templateUrl: './board-sort.html',
  styleUrl: './board-sort.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardSort {
  protected readonly options = SORT_OPTIONS;

  public readonly value = input.required<Sort>();
  public readonly sortChange = output<Sort>();

  protected onChange(event: Event): void {
    this.sortChange.emit((event.target as HTMLSelectElement).value as Sort);
  }
}
