import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../../core/api/schema';
import { toApiError, type ApiError } from '../../core/error/api-error';
import { VoteService } from '../../core/requests/vote.service';

type RequestResponse = components['schemas']['RequestResponse'];

/**
 * `missing` is separate from `failed` because SRS 15.2 asks for a different
 * screen: "This request does not exist any more," with a link back to the
 * board. Offering a Try again button for a request that was deleted would
 * invite someone to press it for ever.
 */
export type DetailState = 'loading' | 'ready' | 'missing' | 'failed';

@Injectable()
export class RequestDetailStore {
  private readonly http = inject(HttpClient);
  private readonly voteService = inject(VoteService);

  private readonly current = signal<DetailState>('loading');
  private readonly row = signal<RequestResponse | null>(null);
  private readonly failure = signal<ApiError | null>(null);
  private readonly voteFailure = signal<ApiError | null>(null);
  private readonly adminFailure = signal<ApiError | null>(null);

  public readonly state: Signal<DetailState> = this.current.asReadonly();
  public readonly request: Signal<RequestResponse | null> = this.row.asReadonly();
  public readonly error: Signal<ApiError | null> = this.failure.asReadonly();
  public readonly voteError: Signal<ApiError | null> = this.voteFailure.asReadonly();
  public readonly adminError: Signal<ApiError | null> = this.adminFailure.asReadonly();

  public readonly voteCount = computed(() => this.row()?.voteCount ?? 0);
  public readonly viewerHasVoted = computed(() => this.row()?.viewerHasVoted ?? false);
  public readonly isMine = computed(() => this.row()?.isMine ?? false);

  public async load(id: string): Promise<void> {
    this.current.set('loading');
    this.failure.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<RequestResponse>(`/v1/requests/${id}`),
      );
      this.row.set(response);
      this.current.set('ready');
    } catch (cause) {
      const error = toApiError(cause);
      this.failure.set(error);
      this.current.set(error.status === 404 ? 'missing' : 'failed');
    }
  }

  public async vote(): Promise<void> {
    const before = this.row();
    if (before === null) {
      return;
    }

    this.voteFailure.set(null);

    const error = await this.voteService.vote(before, (patch) => {
      this.row.update((row) => (row === null ? row : { ...row, ...patch }));
    });

    if (error !== null) {
      this.voteFailure.set(error);
      if (error.status === 404) {
        this.current.set('missing');
      }
    }
  }

  /**
   * R-64: only an admin changes a status, and it shows at once. R-65: only an
   * admin pins, and more than one request may be pinned.
   *
   * Both take the server's answer as the new row rather than patching the field
   * locally: the answer carries the recounted votes and comments too, and
   * keeping a second copy of what changed is how two truths appear on one
   * screen. The button is hidden from a non-admin as a courtesy; the server
   * refuses it either way (R-70, R-93).
   */
  public async changeStatus(statusId: string): Promise<boolean> {
    return this.adminChange((id) =>
      this.http.patch<RequestResponse>(`/v1/requests/${id}/status`, { statusId }),
    );
  }

  public async setPinned(pinned: boolean): Promise<boolean> {
    return this.adminChange((id) =>
      this.http.patch<RequestResponse>(`/v1/requests/${id}/pin`, { pinned }),
    );
  }

  private async adminChange(
    call: (id: string) => ReturnType<HttpClient['patch']>,
  ): Promise<boolean> {
    const before = this.row();
    if (before === null) {
      return false;
    }

    this.adminFailure.set(null);

    try {
      this.row.set((await firstValueFrom(call(before.id))) as RequestResponse);
      return true;
    } catch (cause) {
      // Nothing was changed on screen, so there is nothing to roll back — the
      // row shown is still the row the server has.
      this.adminFailure.set(toApiError(cause));
      return false;
    }
  }

  /** After an edit elsewhere on the page, so the screen shows one truth. */
  public replace(request: RequestResponse): void {
    this.row.set(request);
  }

  /** R-14: delete my own request, or any if I am an admin. */
  public async deleteRequest(): Promise<ApiError | null> {
    const before = this.row();
    if (before === null) {
      return null;
    }

    try {
      await firstValueFrom(this.http.delete<void>(`/v1/requests/${before.id}`));
      return null;
    } catch (cause) {
      return toApiError(cause);
    }
  }
}
