import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BoardStore } from './board.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { DevicePreferencesStore, type Sort } from '../../core/config/device-preferences.store';
import { I18nStore } from '../../core/i18n/i18n.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { resolveBoardQuery, toQueryParams, type BoardQuery } from './board-query';
import { EmptyPanel } from '../../shared/ui/state/empty-panel/empty-panel';
import { ErrorPanel } from '../../shared/ui/state/error-panel/error-panel';
import { SkeletonRows } from '../../shared/ui/state/skeleton-rows/skeleton-rows';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { SnackbarService } from '../../shared/ui/snackbar/snackbar.service';
import { BoardToolbar } from './components/board-toolbar/board-toolbar';
import { RequestGrid } from './components/request-grid/request-grid';
import { RequestFormDialog } from '../request-form/request-form-dialog';
import type { components } from '../../core/api/schema';

type RequestResponse = components['schemas']['RequestResponse'];

@Component({
  selector: 'fh-board',
  imports: [
    RouterLink,
    TranslatePipe,
    EmptyPanel,
    ErrorPanel,
    SkeletonRows,
    Pagination,
    BoardToolbar,
    RequestGrid,
    RequestFormDialog,
  ],
  providers: [BoardStore],
  templateUrl: './board.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  protected readonly board = inject(BoardStore);
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly preferences = inject(DevicePreferencesStore);
  private readonly i18n = inject(I18nStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly creating = signal(false);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly query = computed<BoardQuery>(() => {
    const map = this.params();
    const search = new URLSearchParams();

    for (const key of map?.keys ?? []) {
      for (const value of map?.getAll(key) ?? []) {
        search.append(key, value);
      }
    }

    return resolveBoardQuery(
      search,
      {
        sort: this.preferences.defaultSort(),
        statusIds: this.preferences.defaultStatusIds(),
        categoryIds: this.preferences.defaultCategoryIds(),
        mine: this.preferences.defaultMine(),
      },
      {
        statusIds: this.bootstrap.statuses().map((status) => status.id),
        categoryIds: this.bootstrap.categories().map((category) => category.id),
      },
    );
  });

  private readonly asked = signal('');

  public constructor() {
    effect(() => {
      const query = this.query();
      const key = JSON.stringify(query);

      if (key !== this.asked()) {
        this.asked.set(key);
        void this.board.load(query);
      }
    });
  }

  protected onSearch(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.navigate({ ...this.query(), search: value.trim(), page: 1 });
    }, 300);
  }

  protected onSort(sort: Sort): void {
    // R-58/D-06: a sort picked from the toolbar is also the one this browser
    // opens the board with next time. The URL still wins while it is on screen;
    // this only changes what a clean visit falls back to.
    this.preferences.setDefaultSort(sort);
    this.navigate({ ...this.query(), sort, page: 1 });
  }

  protected toggle(which: 'statusIds' | 'categoryIds', id: string): void {
    const current = this.query()[which];
    const next = current.includes(id) ? current.filter((one) => one !== id) : [...current, id];
    this.remember(which, next);
    this.navigate({ ...this.query(), [which]: next, page: 1 });
  }

  protected toggleMine(): void {
    // R-58/D-06 again: a "My requests" toggle from the toolbar is also what a
    // clean visit falls back to next time. The URL still wins while on screen.
    const next = !this.query().mine;
    this.preferences.setDefaultMine(next);
    this.navigate({ ...this.query(), mine: next, page: 1 });
  }

  protected clearFilters(): void {
    this.preferences.setDefaultStatusIds([]);
    this.preferences.setDefaultCategoryIds([]);
    this.preferences.setDefaultMine(false);
    this.navigate({
      search: '',
      statusIds: [],
      categoryIds: [],
      mine: false,
      sort: this.query().sort,
      page: 1,
    });
  }

  private remember(which: 'statusIds' | 'categoryIds', ids: readonly string[]): void {
    if (which === 'statusIds') {
      this.preferences.setDefaultStatusIds(ids);
    } else {
      this.preferences.setDefaultCategoryIds(ids);
    }
  }

  protected goToPage(page: number): void {
    this.navigate({ ...this.query(), page });
  }

  protected onVoted(event: { id: string; patch: { viewerHasVoted: boolean; voteCount: number } }): void {
    this.board.patchVote(event.id, event.patch);
  }

  protected onDeleted(): void {
    this.snackbar.show(this.i18n.translate('snackbar.requestDeleted'));

    if (this.board.items().length === 0) {
      void this.board.load(this.query());
    }
  }

  protected onCreated(request: RequestResponse): void {
    this.creating.set(false);
    void this.board.load(this.query());
    this.snackbar.show(this.i18n.translate('snackbar.requestCreated'), {
      label: this.i18n.translate('snackbar.view'),
      onAction: () => void this.router.navigate(['/requests', request.id]),
    });
  }

  private navigate(query: BoardQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(query),
    });
  }
}
