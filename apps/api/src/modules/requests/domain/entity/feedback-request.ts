import { ValidationFailedError } from '../../../../shared/errors/app-error';

export interface FeedbackRequestState {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  statusId: string;
  authorId: string;
  isPinned: boolean;
  pinnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** R-12, and the CHECK constraints that back them up in the database (D-24). */
const TITLE = { min: 5, max: 120 };
const DESCRIPTION = { min: 10, max: 5000 };

/**
 * R-10: a request has a title, a description and a category. The person picks
 * these three. **The server sets the status, the author, the time and the
 * counts** — which is why none of them can be passed to `submit`.
 *
 * That signature is the whole of the mass-assignment defence at this layer: a
 * browser that sends `statusId` or `authorId` has nowhere for them to go, and
 * the DTO refuses them before they get this far.
 */
export class FeedbackRequest {
  private constructor(private readonly state: FeedbackRequestState) {}

  public static submit(
    input: { title: string; description: string; categoryId: string },
    context: { authorId: string; statusId: string; id: string },
  ): FeedbackRequest {
    return new FeedbackRequest({
      id: context.id,
      title: checkTitle(input.title),
      description: checkDescription(input.description),
      categoryId: input.categoryId,
      // Set by the server, never chosen by the person (R-11).
      statusId: context.statusId,
      authorId: context.authorId,
      isPinned: false,
      pinnedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  }

  public static rehydrate(state: FeedbackRequestState): FeedbackRequest {
    return new FeedbackRequest({ ...state });
  }

  public get id(): string {
    return this.state.id;
  }
  public get title(): string {
    return this.state.title;
  }
  public get description(): string {
    return this.state.description;
  }
  public get categoryId(): string {
    return this.state.categoryId;
  }
  public get statusId(): string {
    return this.state.statusId;
  }
  public get authorId(): string {
    return this.state.authorId;
  }
  public get isPinned(): boolean {
    return this.state.isPinned;
  }

  /** R-13: the person who wrote it can change the title, text and category. */
  public edit(changes: { title?: string; description?: string; categoryId?: string }): void {
    if (changes.title !== undefined) {
      this.state.title = checkTitle(changes.title);
    }
    if (changes.description !== undefined) {
      this.state.description = checkDescription(changes.description);
    }
    if (changes.categoryId !== undefined) {
      this.state.categoryId = changes.categoryId;
    }
  }

  /** R-64: only an admin changes the status. Who may call this is decided above. */
  public moveTo(statusId: string): void {
    this.state.statusId = statusId;
  }

  /**
   * R-65, R-23: an admin pins and unpins, and a pinned request records when it
   * was pinned so pinned ones keep a fixed order. The database refuses a pin
   * with no time and an unpinned row carrying a stale one.
   */
  public pin(at: Date): void {
    this.state.isPinned = true;
    this.state.pinnedAt = at;
  }

  public unpin(): void {
    this.state.isPinned = false;
    this.state.pinnedAt = null;
  }

  /** R-7: ownership is decided from this row, never from what the browser sent. */
  public isOwnedBy(userId: string): boolean {
    return this.state.authorId === userId;
  }

  public snapshot(): Readonly<FeedbackRequestState> {
    return { ...this.state };
  }
}

function checkTitle(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < TITLE.min || trimmed.length > TITLE.max) {
    throw new ValidationFailedError({ title: 'TITLE_MUST_BE_5_TO_120_CHARACTERS' });
  }

  return trimmed;
}

function checkDescription(value: string): string {
  // Line breaks are kept; nothing else about the text is interpreted (R-98).
  const trimmed = value.trim();

  if (trimmed.length < DESCRIPTION.min || trimmed.length > DESCRIPTION.max) {
    throw new ValidationFailedError({ description: 'DESCRIPTION_MUST_BE_10_TO_5000_CHARACTERS' });
  }

  return trimmed;
}
