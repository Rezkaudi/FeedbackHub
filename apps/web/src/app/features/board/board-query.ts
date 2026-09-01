import type { Sort } from '../../core/config/device-preferences.store';

/**
 * The board's query, and the two directions it travels: read out of the web
 * address, and written back into it.
 *
 * R-22 puts it in the address so a view can be shared and found again with the
 * back button. R-24 says the saved preferences seed it, and the address wins
 * where the two disagree.
 *
 * Pure functions with no Angular in them, because this is the part with the
 * fiddly precedence rules and it should be testable without a router.
 */

export interface BoardQuery {
  readonly search: string;
  readonly statusIds: readonly string[];
  readonly categoryIds: readonly string[];
  /** Show only the requests I wrote. */
  readonly mine: boolean;
  readonly sort: Sort;
  readonly page: number;
}

/** What still exists, so a retired id can be dropped rather than sent. */
export interface Taxonomy {
  readonly statusIds: readonly string[];
  readonly categoryIds: readonly string[];
}

export interface SavedDefaults {
  readonly sort: Sort;
  readonly statusIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly mine: boolean;
}

const SORTS: readonly Sort[] = ['newest', 'oldest', 'most_votes', 'most_comments'];
export const DEFAULT_SORT: Sort = 'newest';

/**
 * The flag that tells "no filters in the address" apart from "no filters, and I
 * mean it".
 *
 * Without it, a link shared with the filters cleared would fall back to
 * whatever the person opening it had saved — so they would see a different
 * board from the one that was sent, and there would be no way to share an
 * unfiltered one at all. Every address this app writes carries it; only an
 * address typed by hand or predating the app will not.
 */
const EXPLICIT = 'filtered';

function ids(params: URLSearchParams, key: string, known: readonly string[]): string[] {
  // R-97 in the browser's half: an id that is not one we were told about never
  // reaches the server. A retired category is the ordinary case (SRS 15.1).
  return params.getAll(key).filter((id) => known.includes(id));
}

function pageOf(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function resolveBoardQuery(
  params: URLSearchParams,
  saved: SavedDefaults,
  taxonomy: Taxonomy,
): BoardQuery {
  const addressHasFilters = params.has(EXPLICIT);

  return {
    search: (params.get('search') ?? '').trim(),

    // R-24: the address wins. Falling back to the saved filters only happens
    // when the address never spoke about them at all.
    statusIds: addressHasFilters
      ? ids(params, 'statusIds', taxonomy.statusIds)
      : saved.statusIds.filter((id) => taxonomy.statusIds.includes(id)),
    categoryIds: addressHasFilters
      ? ids(params, 'categoryIds', taxonomy.categoryIds)
      : saved.categoryIds.filter((id) => taxonomy.categoryIds.includes(id)),

    // R-24 again: the address wins. The saved default only speaks when the
    // address carried no filters at all.
    mine: addressHasFilters ? params.get('mine') === '1' : saved.mine,

    // R-20: only a name from the fixed list. Anything else falls back rather
    // than travelling to the server to be refused there.
    sort: SORTS.find((sort) => sort === params.get('sort')) ?? saved.sort,

    page: pageOf(params.get('page')),
  };
}

/**
 * The address for a query, with everything at its default left out — so an
 * unfiltered board has a clean URL rather than a trail of empty parameters.
 */
export function toQueryParams(query: BoardQuery): Record<string, string | number | string[]> {
  const params: Record<string, string | number | string[]> = { [EXPLICIT]: '1' };

  if (query.search.length > 0) {
    params['search'] = query.search;
  }
  if (query.statusIds.length > 0) {
    params['statusIds'] = [...query.statusIds];
  }
  if (query.categoryIds.length > 0) {
    params['categoryIds'] = [...query.categoryIds];
  }
  if (query.mine) {
    params['mine'] = '1';
  }
  if (query.sort !== DEFAULT_SORT) {
    params['sort'] = query.sort;
  }
  if (query.page !== 1) {
    params['page'] = query.page;
  }

  return params;
}

/** Whether the person has narrowed the board at all — the two empty states
 * read differently, and this is what tells them apart (R-25). */
export function isFiltered(query: BoardQuery): boolean {
  return (
    query.search.length > 0 ||
    query.statusIds.length > 0 ||
    query.categoryIds.length > 0 ||
    query.mine
  );
}
