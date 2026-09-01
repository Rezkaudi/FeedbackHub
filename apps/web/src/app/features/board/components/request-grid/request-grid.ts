import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { RequestCard } from '../request-card/request-card';
import type { RequestRow } from '../../board.store';
import type { VotePatch } from '../../../../core/requests/vote.service';

@Component({
  selector: 'fh-request-grid',
  imports: [RequestCard, TranslatePipe, Icon],
  templateUrl: './request-grid.html',
  styleUrl: './request-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestGrid {
  public readonly items = input.required<readonly RequestRow[]>();
  public readonly voted = output<{ id: string; patch: VotePatch }>();
  public readonly deleted = output<string>();

  /** R-23: the server sends pinned rows first. */
  protected readonly pinned = computed(() => this.items().filter((request) => request.isPinned));
  protected readonly rest = computed(() => this.items().filter((request) => !request.isPinned));

  /**
   * The divider only earns its place when both groups are on screen. One lone
   * heading above a full list, or above nothing, is just noise.
   */
  protected readonly grouped = computed(
    () => this.pinned().length > 0 && this.rest().length > 0,
  );
}
