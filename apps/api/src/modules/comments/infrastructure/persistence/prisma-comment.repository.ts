import { Injectable } from '@nestjs/common';
import { Comment as CommentRow, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  CommentPage,
  CommentRepository,
  CommentViewer,
} from '../../application/port/comment-repository';
import { Comment } from '../../domain/entity/comment';
import { CommentCursor, encodeCursor } from '../../domain/entity/comment-cursor';

function toComment(row: CommentRow): Comment {
  return Comment.rehydrate({
    id: row.id,
    requestId: row.requestId,
    authorId: row.authorId,
    body: row.body,
    state: row.state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  });
}

@Injectable()
export class PrismaCommentRepository implements CommentRepository {
  public constructor(private readonly prisma: PrismaService) {}

  /**
   * R-33a: created_at newest first, with id newest first as the tie-breaker.
   * Two comments saved in the same moment must still come back in the same order
   * every time, or one is shown twice or missed.
   *
   * The index `comments (request_id, created_at DESC, id DESC)` exists for
   * exactly this read (R-106), so the cursor comparison is an index seek rather
   * than a scan.
   */
  public async list(
    requestId: string,
    viewer: CommentViewer,
    limit: number,
    cursor: CommentCursor | undefined,
  ): Promise<CommentPage> {
    // R-40: a waiting comment is seen only by its writer and by admins.
    const visible: Prisma.CommentWhereInput = viewer.isAdmin
      ? {}
      : { OR: [{ state: 'published' }, { authorId: viewer.id }] };

    const where: Prisma.CommentWhereInput = { requestId, ...visible };

    // Ask for one more than asked: its presence is what tells us there is a
    // next page, without a second count query.
    const rows = await this.prisma.comment.findMany({
      where: cursor === undefined
        ? where
        : {
            AND: [
              where,
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              },
            ],
          },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    /**
     * R-33c: the total is counted for the person asking. A pending comment is
     * counted only for its own author and for admins.
     */
    const total = await this.prisma.comment.count({
      where: {
        requestId,
        ...(viewer.isAdmin
          ? { state: { in: ['published', 'pending'] } }
          : {
              OR: [
                { state: 'published' },
                { state: 'pending', authorId: viewer.id },
              ],
            }),
      },
    });

    return {
      comments: page.map(toComment),
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor({ createdAt: last.createdAt, id: last.id })
          : null,
      total,
    };
  }

  public async findById(id: string): Promise<Comment | null> {
    const row = await this.prisma.comment.findUnique({ where: { id } });
    return row === null ? null : toComment(row);
  }

  public async add(comment: Comment): Promise<Comment> {
    const data = comment.snapshot();
    const row = await this.prisma.comment.create({
      data: {
        id: data.id,
        requestId: data.requestId,
        authorId: data.authorId,
        body: data.body,
        state: data.state,
      },
    });
    return toComment(row);
  }

  public async save(comment: Comment): Promise<Comment> {
    const data = comment.snapshot();
    const row = await this.prisma.comment.update({
      where: { id: data.id },
      // request_id and author_id are never written after creation: a comment
      // cannot move or change hands.
      data: { body: data.body, state: data.state },
    });
    return toComment(row);
  }

  /** R-37, R-38: a deleted comment is gone for good, row and all. */
  public async remove(id: string): Promise<void> {
    await this.prisma.comment.delete({ where: { id } });
  }

  public async listPending(): Promise<Comment[]> {
    const rows = await this.prisma.comment.findMany({
      where: { state: 'pending' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toComment);
  }
}
