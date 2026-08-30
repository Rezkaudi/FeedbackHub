import { ValidationFailedError } from '../../../../shared/errors/app-error';

/**
 * What the board can be asked for (R-17 to R-24).
 *
 * R-20 is the rule that matters most here: **the server only accepts sort names
 * from a fixed list**, and a name from the user never goes into the database
 * query as it is. That list lives here, as a closed set, so there is exactly one
 * place where a sort name can be introduced and it cannot be a string from a
 * request.
 */
export const SORTS = ['newest', 'oldest', 'most_votes', 'most_comments'] as const;
export type Sort = (typeof SORTS)[number];

export const DEFAULT_PAGE_SIZE = 20;

export function toSort(value: string | undefined): Sort {
  if (value === undefined) {
    return 'newest';
  }

  // Not a lookup into a map built from user input: an explicit membership test
  // against a frozen list.
  const found = SORTS.find((sort) => sort === value);

  if (found === undefined) {
    throw new ValidationFailedError({ sort: 'SORT_MUST_BE_ONE_OF_THE_KNOWN_NAMES' });
  }

  return found;
}

export interface BoardQuery {
  /** R-17: over the title and the description. Never over comments. */
  readonly search?: string;
  /** R-18: more than one may be picked. Inside one filter it means "or". */
  readonly statusIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly sort: Sort;
  readonly page: number;
  readonly pageSize: number;
}

export interface BoardRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly categoryId: string;
  readonly statusId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly authorAvatarUrl: string | null;
  readonly isPinned: boolean;
  readonly createdAt: Date;
  /** Changes only when the text changes — not on a vote or a comment. */
  readonly updatedAt: Date;
  /** R-28: counted from the real rows, never stored. */
  readonly voteCount: number;
  readonly commentCount: number;
  /** Whether the person asking has voted — one query, not one per row. */
  readonly viewerHasVoted: boolean;
}

export interface BoardPage {
  readonly rows: readonly BoardRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
