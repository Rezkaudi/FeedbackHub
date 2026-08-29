import { Injectable } from '@nestjs/common';
import {
  CommentAuthor,
  CommentAuthorReader,
} from '../../application/port/comment-author-reader';
import { IdentityService } from '../../../identity/identity.service';

/**
 * Reads author names through the identity module's published service (R-141).
 * `comments` never touches the `users` table, and this adapter is the seam.
 */
@Injectable()
export class IdentityCommentAuthorReader implements CommentAuthorReader {
  public constructor(private readonly identity: IdentityService) {}

  public byIds(userIds: readonly string[]): Promise<ReadonlyMap<string, CommentAuthor>> {
    return this.identity.displayFor(userIds);
  }
}
