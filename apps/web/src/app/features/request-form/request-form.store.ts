import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../../core/api/schema';
import { toApiError, type ApiError } from '../../core/error/api-error';

type RequestResponse = components['schemas']['RequestResponse'];

/**
 * R-10: the person picks a title, a description and a category, and nothing
 * else. The server sets the status, the author, the time and the counts.
 *
 * This type is the whole of what a browser may propose. It is not a subset of
 * the response by accident — it is the line R-10 draws, written down.
 */
export interface RequestDraft {
  readonly title: string;
  readonly description: string;
  readonly categoryId: string;
}

/**
 * `notAllowed` is its own state because SRS 15.2 asks for "a clear message, no
 * form" when somebody opens the edit page for a request that is not theirs.
 * Showing the form and failing on save would waste what they typed.
 */
export type FormState = 'loading' | 'ready' | 'missing' | 'notAllowed' | 'failed';

@Injectable()
export class RequestFormStore {
  private readonly http = inject(HttpClient);

  private readonly current = signal<FormState>('ready');
  private readonly original = signal<RequestDraft | null>(null);
  private readonly failure = signal<ApiError | null>(null);
  private readonly busy = signal(false);

  public readonly state: Signal<FormState> = this.current.asReadonly();
  public readonly initial: Signal<RequestDraft | null> = this.original.asReadonly();
  public readonly error: Signal<ApiError | null> = this.failure.asReadonly();
  public readonly isSaving: Signal<boolean> = this.busy.asReadonly();

  /** Editing: read the request, and refuse the form if it is not theirs. */
  public async load(id: string): Promise<void> {
    this.current.set('loading');
    this.failure.set(null);

    try {
      const request = await firstValueFrom(this.http.get<RequestResponse>(`/v1/requests/${id}`));

      // R-93: this is a courtesy, not the check. The server refuses a PATCH from
      // somebody who does not own the row whatever this decides (SRS 15.2), and
      // an admin editing any request is allowed by R-13 — `isMine` is the
      // server's own answer about this viewer, so we do not recompute it.
      if (!request.isMine) {
        this.current.set('notAllowed');
        return;
      }

      this.original.set({
        title: request.title,
        description: request.description,
        categoryId: request.categoryId,
      });
      this.current.set('ready');
    } catch (cause) {
      const error = toApiError(cause);
      this.failure.set(error);
      this.current.set(error.status === 404 ? 'missing' : 'failed');
    }
  }

  public create(draft: RequestDraft): Promise<RequestResponse | null> {
    return this.send(() => this.http.post<RequestResponse>('/v1/requests', bodyOf(draft)));
  }

  public update(id: string, draft: RequestDraft): Promise<RequestResponse | null> {
    return this.send(() => this.http.patch<RequestResponse>(`/v1/requests/${id}`, bodyOf(draft)));
  }

  public async remove(id: string): Promise<boolean> {
    if (this.busy()) {
      return false;
    }

    this.busy.set(true);
    this.failure.set(null);

    try {
      await firstValueFrom(this.http.delete<void>(`/v1/requests/${id}`));
      return true;
    } catch (cause) {
      // Never navigate away on a failure: the request is still there, and
      // pretending otherwise would leave the person confused about what
      // happened to it.
      this.failure.set(toApiError(cause));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * SRS 15.3: "Two fast clicks on Save -> only one request is made."
   *
   * A second POST would create a second request, which is worse than a second
   * vote: there is no unique index to catch it, and the person would have to
   * delete the duplicate themselves.
   */
  private async send(
    call: () => ReturnType<HttpClient['post']>,
  ): Promise<RequestResponse | null> {
    if (this.busy()) {
      return null;
    }

    this.busy.set(true);
    this.failure.set(null);

    try {
      return (await firstValueFrom(call())) as RequestResponse;
    } catch (cause) {
      // SRS 15.3: the form stays filled in. The caller keeps the draft, so
      // returning null here loses nothing the person typed.
      this.failure.set(toApiError(cause));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}

/** Exactly the three fields of R-10, and never anything else. */
function bodyOf(draft: RequestDraft): RequestDraft {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    categoryId: draft.categoryId,
  };
}
