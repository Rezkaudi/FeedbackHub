/**
 * The names and pictures shown beside comments.
 *
 * A separate port so the list can fetch every author in **one** query rather
 * than one per comment (R-103: no N+1). It is implemented over the identity
 * module's published service, so `comments` still never reads `users` itself
 * (R-141).
 */
export interface CommentAuthor {
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface CommentAuthorReader {
  byIds(userIds: readonly string[]): Promise<ReadonlyMap<string, CommentAuthor>>;
}

export const COMMENT_AUTHOR_READER = Symbol('CommentAuthorReader');
