import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../../core/api/schema';
import { toApiError, type ApiError } from '../../core/error/api-error';

type CommentPage = components['schemas']['CommentPageResponse'];
export type Comment = components['schemas']['CommentResponse'];

export type CommentsState = 'loading' | 'ready' | 'empty' | 'failed';

const PAGE_SIZE = 20;

/**
 * The thread: flat, newest first, read with a cursor (R-33, R-33b).
 *
 * Page numbers were rejected by the SRS for a specific reason, and it is worth
 * repeating here because it is the thing this store is shaped around: with
 * newest-first ordering, a comment arriving while somebody reads pushes every
 * later comment down one, so page 2 repeats a row page 1 already showed. A
 * cursor names the row to continue from, so an insertion at the top cannot
 * shift the window.
 *
 * It fails on its own, separately from the request (SRS 15.2): a thread that
 * would not load must not take down a page that otherwise works.
 */
@Injectable()
export class CommentsStore {
  private readonly http = inject(HttpClient);

  private requestId = '';
  private cursor: string | null = null;

  private readonly current = signal<CommentsState>('loading');
  private readonly rows = signal<readonly Comment[]>([]);
  private readonly count = signal(0);
  private readonly failure = signal<ApiError | null>(null);
  private readonly moreFailure = signal<ApiError | null>(null);
  private readonly addFailure = signal<ApiError | null>(null);
  private readonly text = signal('');
  private readonly busy = signal(false);

  public readonly state: Signal<CommentsState> = this.current.asReadonly();
  public readonly items: Signal<readonly Comment[]> = this.rows.asReadonly();
  public readonly total: Signal<number> = this.count.asReadonly();
  public readonly error: Signal<ApiError | null> = this.failure.asReadonly();
  public readonly moreError: Signal<ApiError | null> = this.moreFailure.asReadonly();
  public readonly addError: Signal<ApiError | null> = this.addFailure.asReadonly();
  public readonly draft: Signal<string> = this.text.asReadonly();
  public readonly isSaving: Signal<boolean> = this.busy.asReadonly();

  public readonly hasMore = computed(() => this.cursorSignal() !== null);
  private readonly cursorSignal = signal<string | null>(null);

  public setDraft(value: string): void {
    this.text.set(value);
  }

  public async load(requestId: string): Promise<void> {
    this.requestId = requestId;
    this.current.set('loading');
    this.failure.set(null);

    try {
      const page = await firstValueFrom(
        this.http.get<CommentPage>(`/v1/requests/${requestId}/comments`, {
          params: new HttpParams().set('limit', PAGE_SIZE),
        }),
      );

      this.rows.set(page.items);
      this.count.set(page.total);
      this.setCursor(page.nextCursor);
      this.current.set(page.items.length > 0 ? 'ready' : 'empty');
    } catch (cause) {
      this.failure.set(toApiError(cause));
      this.current.set('failed');
    }
  }

  /** R-33b: give back exactly the cursor we were handed. It means nothing to
   * the browser, and interpreting it would couple us to how the server built
   * it. */
  public async loadMore(): Promise<void> {
    const cursor = this.cursor;
    if (cursor === null) {
      return;
    }

    this.moreFailure.set(null);

    try {
      const page = await firstValueFrom(
        this.http.get<CommentPage>(`/v1/requests/${this.requestId}/comments`, {
          params: new HttpParams().set('limit', PAGE_SIZE).set('cursor', cursor),
        }),
      );

      // Belt and braces against the one thing R-33b exists to prevent. The
      // cursor should make an overlap impossible, but a comment deleted between
      // the two reads can shift the window, and showing a row twice is a bug a
      // person will notice long before we do.
      const seen = new Set(this.rows().map((comment) => comment.id));
      const fresh = page.items.filter((comment) => !seen.has(comment.id));

      this.rows.set([...this.rows(), ...fresh]);
      this.count.set(page.total);
      this.setCursor(page.nextCursor);
    } catch (cause) {
      // The thread already on screen is still readable, so this is not the
      // whole part failing — just this one button.
      this.moreFailure.set(toApiError(cause));
    }
  }

  /**
   * R-33d: it goes to the top at once, with no reload and no second call. The
   * answer already carries the saved comment, so re-reading the list would be
   * a round trip that can only tell us what we have.
   */
  public async add(): Promise<void> {
    // The draft is the only copy of what the person typed. Taking it as an
    // argument would let the caller pass one thing while the box held another,
    // and "the text stays in the box on failure" would then be a coincidence
    // rather than a guarantee.
    const trimmed = this.text().trim();
    if (trimmed.length === 0 || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.addFailure.set(null);

    try {
      const saved = await firstValueFrom(
        this.http.post<Comment>(`/v1/requests/${this.requestId}/comments`, { body: trimmed }),
      );

      this.rows.set([saved, ...this.rows()]);

      // R-40: a comment waiting for approval is not counted until it is
      // approved — not even for the person who wrote it, who can see it.
      if (saved.state === 'published') {
        this.count.update((total) => total + 1);
      }

      this.current.set('ready');
      this.text.set('');
    } catch (cause) {
      // SRS 15.5: the text stays in the box. Throwing away what somebody wrote
      // because a request failed is the worst thing this screen could do.
      this.addFailure.set(toApiError(cause));
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * R-38: the row stays as a grey line so the thread keeps its shape, and R-39
   * stops counting it. Done locally from the answer rather than by re-reading,
   * for the same reason as `add`.
   */
  public async remove(commentId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<void>(`/v1/comments/${commentId}`));

      this.rows.set(
        this.rows().map((comment) =>
          comment.id === commentId ? { ...comment, state: 'deleted' as const, body: '' } : comment,
        ),
      );
      this.count.update((total) => Math.max(0, total - 1));
    } catch (cause) {
      this.moreFailure.set(toApiError(cause));
    }
  }

  private setCursor(next: string | null): void {
    this.cursor = next;
    this.cursorSignal.set(next);
  }
}
