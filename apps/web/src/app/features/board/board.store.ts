import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../../core/api/schema';
import { toApiError, type ApiError } from '../../core/error/api-error';
import { isFiltered, type BoardQuery } from './board-query';

type BoardResponse = components['schemas']['BoardResponse'];
export type RequestRow = components['schemas']['RequestResponse'];

/**
 * R-25 names four states, and the two empty ones are not the same thing:
 * "No requests yet. Be the first." is what a new company sees and it must not
 * look broken, while "Nothing matches these filters" needs a Clear button.
 * Which one to show depends on the query, not on the answer, so the store
 * decides it once rather than every screen guessing.
 */
export type BoardState = 'loading' | 'ready' | 'empty' | 'emptyForFilters' | 'failed';

@Injectable()
export class BoardStore {
  private readonly http = inject(HttpClient);

  private readonly current = signal<BoardState>('loading');
  private readonly rows = signal<readonly RequestRow[]>([]);
  private readonly count = signal(0);
  private readonly currentPage = signal(1);
  private readonly size = signal(20);
  private readonly failure = signal<ApiError | null>(null);

  /**
   * Which load is the newest. Typing in the search box fires one request per
   * pause, and a slow earlier answer landing after a fast later one would show
   * results for words the person has already replaced. Only the newest token
   * may write to the signals.
   */
  private token = 0;

  public readonly state: Signal<BoardState> = this.current.asReadonly();
  public readonly items: Signal<readonly RequestRow[]> = this.rows.asReadonly();
  public readonly total: Signal<number> = this.count.asReadonly();
  public readonly page: Signal<number> = this.currentPage.asReadonly();
  public readonly error: Signal<ApiError | null> = this.failure.asReadonly();

  public readonly pageCount = computed(() => Math.max(1, Math.ceil(this.count() / this.size())));

  public async load(query: BoardQuery): Promise<void> {
    await this.fetch(query, { mayCorrectPage: true });
  }

  private async fetch(query: BoardQuery, options: { mayCorrectPage: boolean }): Promise<void> {
    const mine = ++this.token;
    this.current.set('loading');
    this.failure.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<BoardResponse>('/v1/requests', { params: paramsFor(query) }),
      );

      // A newer load started while this one was in flight. Its answer is the
      // one the person is waiting for, so this one is dropped entirely.
      if (mine !== this.token) {
        return;
      }

      /**
       * SRS 15.1: "Page 5 of a list that shrank to 2 pages -> go back to the
       * last real page, do not show an empty page."
       *
       * Bookmarks outlive the rows they pointed at. `mayCorrectPage` makes this
       * happen at most once, so a server that disagrees about the page count
       * cannot bounce us round for ever.
       */
      const lastPage = Math.max(1, Math.ceil(response.total / response.pageSize));
      if (options.mayCorrectPage && response.items.length === 0 && query.page > lastPage) {
        await this.fetch({ ...query, page: lastPage }, { mayCorrectPage: false });
        return;
      }

      this.rows.set(response.items);
      this.count.set(response.total);
      this.currentPage.set(response.page);
      this.size.set(response.pageSize);
      this.current.set(
        response.items.length > 0 ? 'ready' : isFiltered(query) ? 'emptyForFilters' : 'empty',
      );
    } catch (cause) {
      if (mine !== this.token) {
        return;
      }

      // R-25: "Filters stay as they were." The rows already on screen stay too
      // — blanking the board on a failed reload throws away what the person was
      // reading and tells them nothing extra.
      this.failure.set(toApiError(cause));
      this.current.set('failed');
    }
  }
}

/** R-21, R-17, R-18, R-19 as query parameters. Empty values are left out
 * entirely rather than sent as blanks the server has to interpret. */
function paramsFor(query: BoardQuery): HttpParams {
  let params = new HttpParams().set('page', query.page).set('pageSize', 20);

  if (query.search.length > 0) {
    params = params.set('search', query.search);
  }
  for (const id of query.statusIds) {
    params = params.append('statusIds', id);
  }
  for (const id of query.categoryIds) {
    params = params.append('categoryIds', id);
  }
  params = params.set('sort', query.sort);

  return params;
}
