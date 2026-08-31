import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nStore } from '../../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { IconButton } from '../../../../shared/ui/icon-button/icon-button';

@Component({
  selector: 'fh-board-search',
  imports: [Icon, IconButton, TranslatePipe],
  templateUrl: './board-search.html',
  styleUrl: './board-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardSearch {
  protected readonly i18n = inject(I18nStore);

  public readonly value = input.required<string>();
  public readonly searchChange = output<string>();

  protected onInput(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.searchChange.emit('');
  }
}
