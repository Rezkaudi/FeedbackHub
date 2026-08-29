import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/http/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { RequiresAdmin } from '../../../shared/http/route-metadata';
import {
  CommentPageResponse,
  CommentResponse,
  EditCommentDto,
  ListCommentsDto,
  WriteCommentDto,
} from './dto/comment.dto';
import { ReadComments } from '../application/use-case/read-comments';
import { WriteComment } from '../application/use-case/write-comment';
import { EditComment } from '../application/use-case/edit-comment';
import { DeleteComment } from '../application/use-case/delete-comment';
import { ModerateComment } from '../application/use-case/moderate-comment';
import {
  COMMENT_AUTHOR_READER,
  CommentAuthorReader,
} from '../application/port/comment-author-reader';
import { Comment } from '../domain/entity/comment';

const DEFAULT_LIMIT = 20;

/**
 * Every route here refuses when the comments switch is off (R-42) — with a
 * message saying so, not a 404 and not a silent success. That is hard part H-5,
 * and the use cases enforce it so no route can forget.
 */
@ApiTags('comments')
@ApiUnauthorizedResponse({ description: 'Not signed in (R-6).' })
@ApiForbiddenResponse({ description: 'Comments are switched off (R-42).' })
@Controller()
export class CommentsController {
  public constructor(
    private readonly readComments: ReadComments,
    private readonly writeComment: WriteComment,
    private readonly editComment: EditComment,
    private readonly deleteComment: DeleteComment,
    private readonly moderateComment: ModerateComment,
    @Inject(COMMENT_AUTHOR_READER) private readonly authors: CommentAuthorReader,
  ) {}

  @Get('requests/:id/comments')
  @ApiOperation({
    summary: 'The comments on a request: flat, newest first, by cursor (R-33).',
    description:
      'Page numbers are not used on purpose: with newest-first they would show the same ' +
      'comment twice whenever a new one arrives while a person is reading (R-33b).',
  })
  @ApiOkResponse({ type: CommentPageResponse })
  public async list(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Query() query: ListCommentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentPageResponse> {
    const page = await this.readComments.execute(requestId, user, {
      limit: query.limit ?? DEFAULT_LIMIT,
      cursor: query.cursor,
    });

    return {
      items: await this.render(page.comments, user),
      nextCursor: page.nextCursor,
      total: page.total,
    };
  }

  @Post('requests/:id/comments')
  @ApiOperation({ summary: 'Write a comment (R-32).' })
  @ApiOkResponse({ type: CommentResponse })
  @ApiNotFoundResponse({ description: 'The request was deleted (SRS 15.5).' })
  public async write(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() body: WriteCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentResponse> {
    const comment = await this.writeComment.execute(requestId, body.body, user);
    const [rendered] = await this.render([comment], user);
    return rendered as CommentResponse;
  }

  @Patch('comments/:id')
  @ApiOperation({
    summary: 'Change my own comment (R-35).',
    description: 'An admin cannot edit someone else\'s: moderation means deleting (R-36).',
  })
  @ApiOkResponse({ type: CommentResponse })
  public async edit(
    @Param('id', ParseUUIDPipe) commentId: string,
    @Body() body: EditCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentResponse> {
    const comment = await this.editComment.execute(commentId, body.body, user);
    const [rendered] = await this.render([comment], user);
    return rendered as CommentResponse;
  }

  @Delete('comments/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete my own comment; an admin can delete any (R-37).' })
  @ApiNoContentResponse({ description: 'It is now a grey line (R-38).' })
  public async remove(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteComment.execute(commentId, user);
  }

  @Get('admin/comments/pending')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Comments waiting for approval (R-41).' })
  @ApiOkResponse({ type: [CommentResponse] })
  public async waiting(@CurrentUser() user: AuthenticatedUser): Promise<CommentResponse[]> {
    return this.render(await this.moderateComment.listWaiting(), user);
  }

  @Post('admin/comments/:id/approve')
  @RequiresAdmin()
  @ApiOperation({
    summary: 'Approve a waiting comment (R-41).',
    description: 'The email to the request author is sent now, not when it was written (R-125).',
  })
  @ApiOkResponse({ type: CommentResponse })
  public async approve(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentResponse> {
    const comment = await this.moderateComment.approve(commentId);
    const [rendered] = await this.render([comment], user);
    return rendered as CommentResponse;
  }

  @Post('admin/comments/:id/reject')
  @RequiresAdmin()
  @ApiOperation({
    summary: 'Reject a waiting comment: it becomes a grey line (R-41).',
    description: 'A rejected comment is never emailed (R-125).',
  })
  @ApiOkResponse({ type: CommentResponse })
  public async reject(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentResponse> {
    const comment = await this.moderateComment.reject(commentId);
    const [rendered] = await this.render([comment], user);
    return rendered as CommentResponse;
  }

  /** One author lookup for the whole list, never one per comment (R-103). */
  private async render(
    comments: readonly Comment[],
    viewer: AuthenticatedUser,
  ): Promise<CommentResponse[]> {
    const authors = await this.authors.byIds([...new Set(comments.map((c) => c.authorId))]);

    return comments.map((comment) =>
      CommentResponse.from(
        comment,
        authors.get(comment.authorId) ?? { displayName: 'Deleted user', avatarUrl: null },
        viewer.id,
      ),
    );
  }
}
