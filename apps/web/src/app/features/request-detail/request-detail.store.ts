import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../../core/api/schema';
import { toApiError, type ApiError } from '../../core/error/api-error';

type RequestResponse = components['schemas']['RequestResponse'];
type VoteState = components['schemas']['VoteStateResponse'];

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

  private readonly current = signal<DetailState>('loading');
  private readonly row = signal<RequestResponse | null>(null);
  private readonly failure = signal<ApiError | null>(null);
  private readonly voteFailure = signal<ApiError | null>(null);
  private readonly adminFailure = signal<ApiError | null>(null);

  /** A vote is in flight. A second click while it is must do nothing at all. */
  private voting = false;

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

  /**
   * Vote, or take the vote back — one action, because from the person's side it
   * is one button (R-31).
   *
   * The number moves first (R-30). That is a prediction, and it is allowed to
   * be wrong: R-28 says the count belongs to the server, so the answer replaces
   * it outright rather than being added to it. If somebody else voted while
   * this call was in flight, the server's number is right and ours was not.
   */
  public async vote(): Promise<void> {
    const before = this.row();
    if (before === null || this.voting) {
      // SRS 15.4: a double click is still one vote. The database guarantees that
      // (R-26); what the screen must add is not sending a second call, which
      // would be an un-vote and would undo the first.
      return;
    }

    this.voting = true;
    this.voteFailure.set(null);

    const removing = before.viewerHasVoted;
    this.row.set({
      ...before,
      viewerHasVoted: !removing,
      voteCount: before.voteCount + (removing ? -1 : 1),
    });

    try {
      const url = `/v1/requests/${before.id}/vote`;
      const answer = await firstValueFrom(
        removing ? this.http.delete<VoteState>(url) : this.http.post<VoteState>(url, null),
      );

      // The server's numbers, not ours. The prediction was only ever a way to
      // make the button feel immediate.
      this.row.set({
        ...before,
        viewerHasVoted: answer.viewerHasVoted,
        voteCount: answer.voteCount,
      });
    } catch (cause) {
      const error = toApiError(cause);

      // Put it back exactly as it was, then say why (R-30).
      this.row.set(before);
      this.voteFailure.set(error);

      // SRS 15.4: the request was deleted a second ago. Nothing to roll back
      // to, so the page has to say so.
      if (error.status === 404) {
        this.current.set('missing');
      }
    } finally {
      this.voting = false;
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
}
