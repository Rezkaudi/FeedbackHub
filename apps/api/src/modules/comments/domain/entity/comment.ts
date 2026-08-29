import { ValidationFailedError, ForbiddenError } from '../../../../shared/errors/app-error';

export type CommentState = 'published' | 'pending' | 'deleted';

export interface CommentData {
  id: string;
  requestId: string;
  authorId: string;
  body: string;
  state: CommentState;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** R-32: 1 to 2000 letters. The database enforces the same range (D-24). */
const BODY = { min: 1, max: 2000 };

export class Comment {
  private constructor(private readonly data: CommentData) {}

  /**
   * R-40: when the admin turns on "comments need approval", a new comment waits.
   * Where it starts is decided by the setting, so the caller passes it in rather
   * than the entity reading a setting it should not know about.
   */
  public static write(
    input: { requestId: string; authorId: string; body: string },
    context: { id: string; needsApproval: boolean },
  ): Comment {
    return new Comment({
      id: context.id,
      requestId: input.requestId,
      authorId: input.authorId,
      body: checkBody(input.body),
      state: context.needsApproval ? 'pending' : 'published',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deletedAt: null,
    });
  }

  public static rehydrate(data: CommentData): Comment {
    return new Comment({ ...data });
  }

  public get id(): string {
    return this.data.id;
  }
  public get requestId(): string {
    return this.data.requestId;
  }
  public get authorId(): string {
    return this.data.authorId;
  }
  public get body(): string {
    return this.data.body;
  }
  public get state(): CommentState {
    return this.data.state;
  }
  public get isDeleted(): boolean {
    return this.data.state === 'deleted';
  }
  public get isPending(): boolean {
    return this.data.state === 'pending';
  }

  /**
   * R-35, R-36: the writer can edit their own comment. An admin cannot edit
   * someone else's — moderation means deleting, never changing words.
   *
   * That rule is enforced here rather than in a guard because it is the one
   * permission in the app where being an admin gives you *less* than usual, and
   * it would be easy to widen by accident in a controller.
   */
  public editBy(newBody: string, editor: { id: string }): void {
    if (this.data.authorId !== editor.id) {
      throw new ForbiddenError('Only the person who wrote a comment can change its words.');
    }

    // R-39: deleted comments cannot be edited.
    if (this.isDeleted) {
      throw new ForbiddenError('This comment was deleted.');
    }

    this.data.body = checkBody(newBody);
  }

  /**
   * R-38: a deleted comment leaves a small grey line. The row stays so the
   * thread still makes sense, and the text is gone for good — which is why the
   * body is emptied rather than hidden.
   */
  public delete(at: Date): void {
    this.data.body = '';
    this.data.state = 'deleted';
    this.data.deletedAt = at;
  }

  /** R-41: an admin approves a waiting comment, and it appears. */
  public approve(): void {
    if (this.data.state === 'pending') {
      this.data.state = 'published';
    }
  }

  /** R-41: rejecting makes it a deleted line, exactly like any other deletion. */
  public reject(at: Date): void {
    this.delete(at);
  }

  /**
   * R-40: a waiting comment is seen only by its writer and by admins. This is
   * also what makes two people see two different totals on the same request and
   * both be right (R-33c).
   */
  public isVisibleTo(viewer: { id: string; isAdmin: boolean }): boolean {
    if (this.data.state === 'pending') {
      return viewer.isAdmin || this.data.authorId === viewer.id;
    }

    return true;
  }

  public snapshot(): Readonly<CommentData> {
    return { ...this.data };
  }
}

function checkBody(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < BODY.min || trimmed.length > BODY.max) {
    throw new ValidationFailedError({ body: 'COMMENT_MUST_BE_1_TO_2000_CHARACTERS' });
  }

  return trimmed;
}
