import { Injectable } from '@nestjs/common';
import { FeedbackRequest as RequestRow, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  BoardViewer,
  RequestRepository,
} from '../../application/port/request-repository';
import { FeedbackRequest } from '../../domain/entity/feedback-request';
import { BoardPage, BoardQuery, BoardRow, Sort } from '../../domain/entity/board-query';
import { withinRateLimit } from '../../../../shared/rate-limit/sliding-window';

function toRequest(row: RequestRow): FeedbackRequest {
  return FeedbackRequest.rehydrate({
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    statusId: row.statusId,
    authorId: row.authorId,
    isPinned: row.isPinned,
    pinnedAt: row.pinnedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * R-19 and R-20 together: the four sorts we offer, as SQL fragments chosen by a
 * closed union type. A sort name from a request is turned into one of these four
 * values *before* it reaches here (see toSort), so no user string is ever part
 * of the statement — which is the whole of R-97 for the one place an ORDER BY
 * cannot be a bound parameter.
 *
 * Every one ends with `r.id DESC` so the order is total: without a tie-breaker,
 * two requests with the same vote count could swap places between pages and a
 * row would be shown twice or missed.
 */
const ORDER_BY: Record<Sort, Prisma.Sql> = {
  newest: Prisma.sql`r.created_at DESC, r.id DESC`,
  oldest: Prisma.sql`r.created_at ASC, r.id ASC`,
  most_votes: Prisma.sql`vote_count DESC, r.created_at DESC, r.id DESC`,
  most_comments: Prisma.sql`comment_count DESC, r.created_at DESC, r.id DESC`,
};

interface BoardSqlRow {
  id: string;
  title: string;
  description: string;
  category_id: string;
  status_id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  is_pinned: boolean;
  created_at: Date;
  vote_count: bigint;
  comment_count: bigint;
  viewer_has_voted: boolean;
  total: bigint;
}

@Injectable()
export class PrismaRequestRepository implements RequestRepository {
  public constructor(private readonly prisma: PrismaService) {}

  /**
   * R-148: the board is one SQL statement — search, both filters, the sort,
   * pinned-first, the page, and the two derived counts. Doing it through the
   * ORM's object API would mean several round trips or a query we cannot read.
   *
   * Why it is not N+1: the counts are lateral sub-selects evaluated once per
   * returned row, and the total comes from a window function in the same pass,
   * so the whole board is a single round trip whatever the page size.
   *
   * Every value is a bound parameter (R-97). The only pieces of literal SQL that
   * vary are the ORDER BY fragments above, which are chosen by a closed type and
   * can never contain anything a person typed.
   */
  public async board(
    query: BoardQuery,
    viewer: BoardViewer,
    commentsEnabled: boolean,
  ): Promise<BoardPage> {
    const rows = await this.select(
      this.filtersFor(query),
      Prisma.sql`ORDER BY r.is_pinned DESC, r.pinned_at DESC NULLS LAST, ${ORDER_BY[query.sort]}
                 LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      viewer,
      commentsEnabled,
    );

    return {
      rows: rows.map(toBoardRow),
      // With no rows there is no window-function total, and no rows means none
      // matched — unless the page is past the end, which the use case handles.
      total: Number(rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  public async boardRow(
    requestId: string,
    viewer: BoardViewer,
    commentsEnabled: boolean,
  ): Promise<BoardRow | null> {
    const rows = await this.select(
      Prisma.sql`r.id = ${requestId}::uuid`,
      Prisma.sql`LIMIT 1`,
      viewer,
      commentsEnabled,
    );

    const row = rows[0];
    return row === undefined ? null : toBoardRow(row);
  }

  /** R-18, R-17, R-20 turned into bound SQL. Never a user string in the text. */
  private filtersFor(query: BoardQuery): Prisma.Sql {
    const filters: Prisma.Sql[] = [];

    if (query.search !== undefined && query.search.trim().length > 0) {
      // R-17: over the title and the description, never over comments.
      // ILIKE with a bound parameter; the wildcards are ours, the text is theirs
      // and is escaped by the driver. D-11 accepted no ranking and no stemming.
      const pattern = `%${escapeForLike(query.search.trim())}%`;
      filters.push(
        Prisma.sql`(r.title ILIKE ${pattern} ESCAPE '\\' OR r.description ILIKE ${pattern} ESCAPE '\\')`,
      );
    }

    // R-18: inside one filter it means "or"; between the two it means "and".
    if (query.statusIds.length > 0) {
      filters.push(Prisma.sql`r.status_id IN (${Prisma.join(query.statusIds.map((id) => Prisma.sql`${id}::uuid`))})`);
    }
    if (query.categoryIds.length > 0) {
      filters.push(
        Prisma.sql`r.category_id IN (${Prisma.join(query.categoryIds.map((id) => Prisma.sql`${id}::uuid`))})`,
      );
    }

    return filters.length === 0 ? Prisma.sql`TRUE` : Prisma.join(filters, ' AND ');
  }

  /**
   * The one statement behind both the board and a single request (R-148).
   *
   * Why it is not N+1: the counts are correlated sub-selects evaluated once per
   * returned row, and the total comes from a window function in the same pass,
   * so the whole board is a single round trip whatever the page size.
   */
  private async select(
    where: Prisma.Sql,
    tail: Prisma.Sql,
    viewer: BoardViewer,
    commentsEnabled: boolean,
  ): Promise<BoardSqlRow[]> {
    /**
     * R-33c: a waiting comment is counted only for its writer and for admins.
     * R-42: when the comments switch is off, the count is gone from the board
     * entirely — so we do not even ask the database for it.
     */
    const commentCount = commentsEnabled
      ? Prisma.sql`(
          SELECT count(*) FROM comments c
          WHERE c.request_id = r.id
            AND (
              c.state = 'published'
              OR (c.state = 'pending' AND (${viewer.isAdmin} OR c.author_id = ${viewer.id}::uuid))
            )
        )`
      : Prisma.sql`0::bigint`;

    return this.prisma.$queryRaw<BoardSqlRow[]>`
      SELECT
        r.id,
        r.title,
        r.description,
        r.category_id,
        r.status_id,
        r.author_id,
        u.display_name AS author_name,
        u.avatar_url   AS author_avatar_url,
        r.is_pinned,
        r.created_at,
        (SELECT count(*) FROM votes v WHERE v.request_id = r.id)      AS vote_count,
        ${commentCount}                                               AS comment_count,
        EXISTS (
          SELECT 1 FROM votes v2
          WHERE v2.request_id = r.id AND v2.user_id = ${viewer.id}::uuid
        )                                                             AS viewer_has_voted,
        count(*) OVER ()                                              AS total
      FROM feedback_requests r
      JOIN users u ON u.id = r.author_id
      WHERE ${where}
      -- R-23: pinned first, but only inside the filter the person chose. The
      -- filter is already applied above, so pinning can never reveal a request
      -- the filter says to hide, nor hide one it says to show.
      ${tail}
    `;
  }

  public async findById(id: string): Promise<FeedbackRequest | null> {
    const row = await this.prisma.feedbackRequest.findUnique({ where: { id } });
    return row === null ? null : toRequest(row);
  }

  public async save(request: FeedbackRequest): Promise<FeedbackRequest> {
    const state = request.snapshot();
    const row = await this.prisma.feedbackRequest.update({
      where: { id: state.id },
      // author_id is never written after creation: a request cannot change hands.
      data: {
        title: state.title,
        description: state.description,
        categoryId: state.categoryId,
        statusId: state.statusId,
        isPinned: state.isPinned,
        pinnedAt: state.pinnedAt,
      },
    });
    return toRequest(row);
  }

  /** R-14: deleting removes its votes and its comments too, by cascade. */
  public async remove(id: string): Promise<void> {
    await this.prisma.feedbackRequest.delete({ where: { id } });
  }

  /**
   * R-130 + R-132: the submission limit and the insert in one database step,
   * behind an advisory lock keyed to this person.
   *
   * Known gap, recorded in SCOPE.md: R-131 also says a deleted request should
   * still count while it is inside the window, so that write-delete-write cannot
   * walk around the limit. Deleting a request removes its row (R-14), and the
   * nine tables of SRS part 12 hold nothing else that could remember it, so with
   * no new table there is nothing left to count. The window, the refusal and the
   * retry time are all correct; only that one loop is open.
   */
  public async createWithinSubmissionLimit(
    request: FeedbackRequest,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<FeedbackRequest> {
    const state = request.snapshot();

    return this.prisma.$transaction(async (tx) =>
      withinRateLimit(
        tx,
        {
          key: `submission:${state.authorId}`,
          code: 'SUBMISSION_RATE_LIMITED',
          policy: limit,
        },
        now,
        async (client, since) => {
          const rows = await client.$queryRaw<{ count: bigint; oldest: Date | null }[]>`
            SELECT count(*)::bigint AS count, min(created_at) AS oldest
            FROM feedback_requests
            WHERE author_id = ${state.authorId}::uuid AND created_at >= ${since}
          `;
          return { count: Number(rows[0]?.count ?? 0), oldest: rows[0]?.oldest ?? null };
        },
        async () => {
          const row = await tx.feedbackRequest.create({
            data: {
              id: state.id,
              title: state.title,
              description: state.description,
              categoryId: state.categoryId,
              statusId: state.statusId,
              authorId: state.authorId,
            },
          });
          return toRequest(row);
        },
      ),
    );
  }
}

/**
 * ILIKE treats % and _ as wildcards. Someone searching for "100%" means the
 * characters, not "anything after 100", so they are escaped.
 */
function escapeForLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toBoardRow(row: BoardSqlRow): BoardRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    statusId: row.status_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
    isPinned: row.is_pinned,
    createdAt: row.created_at,
    voteCount: Number(row.vote_count),
    commentCount: Number(row.comment_count),
    viewerHasVoted: row.viewer_has_voted,
  };
}
