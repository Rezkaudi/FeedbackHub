import { Module } from '@nestjs/common';
import { CommentsController } from './http/comments.controller';
import { COMMENT_REPOSITORY } from './application/port/comment-repository';
import { COMMENT_AUTHOR_READER } from './application/port/comment-author-reader';
import { PrismaCommentRepository } from './infrastructure/persistence/prisma-comment.repository';
import { IdentityCommentAuthorReader } from './infrastructure/identity/identity-comment-author-reader';
import { ReadComments } from './application/use-case/read-comments';
import { WriteComment } from './application/use-case/write-comment';
import { EditComment } from './application/use-case/edit-comment';
import { DeleteComment } from './application/use-case/delete-comment';
import { ModerateComment } from './application/use-case/moderate-comment';
import { CommentsMustBeEnabled } from './application/use-case/comments-must-be-enabled';
import { SettingsModule } from '../settings/settings.module';
import { RequestsModule } from '../requests/requests.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';

/** Owns the `comments` table. Nothing else touches it (R-141). */
@Module({
  imports: [SettingsModule, RequestsModule, IdentityModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [
    { provide: COMMENT_REPOSITORY, useClass: PrismaCommentRepository },
    { provide: COMMENT_AUTHOR_READER, useClass: IdentityCommentAuthorReader },
    CommentsMustBeEnabled,
    ReadComments,
    WriteComment,
    EditComment,
    DeleteComment,
    ModerateComment,
  ],
})
export class CommentsModule {}
