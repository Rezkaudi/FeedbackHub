import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY, RequestRepository } from '../port/request-repository';
import { BoardPage, BoardQuery } from '../../domain/entity/board-query';
import { SettingsService } from '../../../settings/settings.service';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';

/**
 * R-16 to R-25. One repository call does the search, both filters, the sort,
 * pinned-first, the page and the two counts (R-148).
 *
 * The one thing decided here rather than in SQL is SRS 15.1's edge case: "page 5
 * of a list that shrank to 2 pages -> go back to the last real page, do not show
 * an empty page". That needs the total, which we only have after asking, so it
 * costs a second query in exactly that case and none otherwise.
 */
@Injectable()
export class ReadBoard {
  public constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
    private readonly settings: SettingsService,
  ) {}

  public async execute(query: BoardQuery, viewer: AuthenticatedUser): Promise<BoardPage> {
    // R-42: with comments switched off, comment counts are gone from the board.
    const commentsEnabled = await this.settings.commentsAreEnabled();
    const asViewer = { id: viewer.id, isAdmin: viewer.role === 'admin' };

    const page = await this.requests.board(query, asViewer, commentsEnabled);

    if (page.rows.length > 0 || query.page === 1) {
      return page;
    }

    /**
     * SRS 15.1: "page 5 of a list that shrank to 2 pages -> go back to the last
     * real page, do not show an empty page."
     *
     * The total comes from a window function over the returned rows, so an
     * empty page carries no total at all — it cannot tell us whether the list
     * is empty or the page is simply past the end. Asking for page 1 answers
     * that, and it only ever happens on this one edge.
     */
    const first = await this.requests.board({ ...query, page: 1 }, asViewer, commentsEnabled);

    if (first.total === 0) {
      // Genuinely nothing matches. The screen shows "nothing matches these
      // filters", which is a different message from "no requests yet" (R-25).
      return first;
    }

    const lastPage = Math.max(1, Math.ceil(first.total / query.pageSize));

    return lastPage === 1
      ? first
      : this.requests.board({ ...query, page: lastPage }, asViewer, commentsEnabled);
  }
}
