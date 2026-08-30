import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BoardStore } from './board.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { DevicePreferencesStore, type Sort } from '../../core/config/device-preferences.store';
import { RequestCard } from './request-card';
import { EmptyPanel, ErrorPanel, SkeletonRows } from '../../shared/ui/state/state-panels';
import { resolveBoardQuery, toQueryParams, type BoardQuery } from './board-query';

const SORT_LABELS: ReadonlyArray<{ value: Sort; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most_votes', label: 'Most votes' },
  { value: 'most_comments', label: 'Most comments' },
];

/**
 * The board (R-16 to R-25).
 *
 * The web address is the single source of truth for what is shown. Changing a
 * filter navigates; the navigation is what triggers the load. Nothing here
 * keeps a second copy of the query that could drift from the URL, which is what
 * makes R-22 — copy the address, get the same board — true by construction
 * rather than by remembering to keep two things in step.
 */
@Component({
  selector: 'fh-board',
  imports: [RouterLink, RequestCard, EmptyPanel, ErrorPanel, SkeletonRows],
  providers: [BoardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-xl">Feedback</h1>
      <a
        routerLink="/requests/new"
        class="bg-accent text-on-accent inline-flex min-h-11 items-center rounded px-4 font-medium"
      >
        New request
      </a>
    </div>

    <!-- Kept on screen in every state, including the failed one: R-25 says the
         filters stay as they were, and a filter bar that vanishes on an error
         throws away what the person typed. -->
    <section aria-label="Filters" class="mt-6 flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <div class="min-w-60 flex-1">
          <label for="board-search" class="mb-1 block text-sm font-medium">Search</label>
          <input
            id="board-search"
            type="search"
            [value]="query().search"
            (input)="onSearch($event)"
            placeholder="Search titles and descriptions"
            class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
          />
        </div>

        <div>
          <label for="board-sort" class="mb-1 block text-sm font-medium">Sort</label>
          <select
            id="board-sort"
            [value]="query().sort"
            (change)="onSort($event)"
            class="border-line-control bg-surface min-h-11 rounded border px-3"
          >
            @for (option of sortOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </div>
      </div>

      <div class="flex flex-wrap gap-6">
        <fieldset>
          <legend class="mb-1 text-sm font-medium">Status</legend>
          <div class="flex flex-wrap gap-3">
            @for (status of bootstrap.activeStatuses(); track status.id) {
              <label class="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  [checked]="query().statusIds.includes(status.id)"
                  (change)="toggle('statusIds', status.id)"
                />
                {{ status.name }}
              </label>
            }
          </div>
        </fieldset>

        <fieldset>
          <legend class="mb-1 text-sm font-medium">Category</legend>
          <div class="flex flex-wrap gap-3">
            @for (category of bootstrap.activeCategories(); track category.id) {
              <label class="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  [checked]="query().categoryIds.includes(category.id)"
                  (change)="toggle('categoryIds', category.id)"
                />
                {{ category.name }}
              </label>
            }
          </div>
        </fieldset>
      </div>
    </section>

    <!-- The count is announced politely, so someone who filters by keyboard
         hears the result without focus being taken from the control (R-92). -->
    @if (board.state() === 'ready') {
      <p aria-live="polite" class="text-muted mt-6 text-sm">
        {{ board.total() }} {{ board.total() === 1 ? 'request' : 'requests' }} found
      </p>
    }

    <div class="mt-4">
      @switch (board.state()) {
        @case ('loading') {
          <fh-skeleton-rows [count]="5" label="Loading requests" />
        }
        @case ('ready') {
          <ul class="flex list-none flex-col gap-3 p-0">
            @for (request of board.items(); track request.id) {
              <li><fh-request-card [request]="request" /></li>
            }
          </ul>

          @if (board.pageCount() > 1) {
            <nav aria-label="Pages" class="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                class="border-line-control min-h-11 rounded border px-4 disabled:opacity-50"
                [disabled]="board.page() <= 1"
                (click)="goToPage(board.page() - 1)"
              >
                Previous
              </button>
              <span class="text-muted text-sm">
                Page {{ board.page() }} of {{ board.pageCount() }}
              </span>
              <button
                type="button"
                class="border-line-control min-h-11 rounded border px-4 disabled:opacity-50"
                [disabled]="board.page() >= board.pageCount()"
                (click)="goToPage(board.page() + 1)"
              >
                Next
              </button>
            </nav>
          }
        }
        @case ('empty') {
          <fh-empty-panel
            heading="No requests yet"
            detail="Nobody has written anything here. Be the first."
          >
            <a routerLink="/requests/new" class="text-accent underline">Write the first request</a>
          </fh-empty-panel>
        }
        @case ('emptyForFilters') {
          <fh-empty-panel
            heading="Nothing matches these filters"
            detail="There are requests on the board, but none of them match what you asked for."
          >
            <button type="button" class="text-accent underline" (click)="clearFilters()">
              Clear filters
            </button>
          </fh-empty-panel>
        }
        @case ('failed') {
          <fh-error-panel
            heading="We could not load the board"
            [detail]="
              board.error()?.isRetryable
                ? 'The server did not answer. This is usually temporary.'
                : 'Something went wrong while loading the requests.'
            "
            [requestId]="board.error()?.requestId ?? ''"
            [canRetry]="board.error()?.isRetryable ?? false"
            (retry)="board.load(query())"
          />
        }
      }
    </div>
  `,
})
export class Board {
  protected readonly board = inject(BoardStore);
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly preferences = inject(DevicePreferencesStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly sortOptions = SORT_LABELS;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * The query, derived from the address every time it changes (R-22, R-24). The
   * saved preferences seed it; the address overrides.
   */
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
      },
      {
        statusIds: this.bootstrap.statuses().map((status) => status.id),
        categoryIds: this.bootstrap.categories().map((category) => category.id),
      },
    );
  });

  /** The last query actually asked for, so an unchanged address does not refetch. */
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

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    // Debounced, and it navigates rather than setting state: the address stays
    // the source of truth, and the back button walks the searches.
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.navigate({ ...this.query(), search: value.trim(), page: 1 });
    }, 300);
  }

  protected onSort(event: Event): void {
    const sort = (event.target as HTMLSelectElement).value as Sort;
    this.navigate({ ...this.query(), sort, page: 1 });
  }

  protected toggle(which: 'statusIds' | 'categoryIds', id: string): void {
    const current = this.query()[which];
    const next = current.includes(id)
      ? current.filter((one) => one !== id)
      : [...current, id];

    // Back to page one: page 4 of the old filter is rarely a page of the new.
    this.navigate({ ...this.query(), [which]: next, page: 1 });
  }

  protected clearFilters(): void {
    this.navigate({ search: '', statusIds: [], categoryIds: [], sort: this.query().sort, page: 1 });
  }

  protected goToPage(page: number): void {
    this.navigate({ ...this.query(), page });
  }

  private navigate(query: BoardQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(query),
    });
  }
}
