import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../api/schema';
import { toApiError, type ApiError } from '../error/api-error';

type VoteState = components['schemas']['VoteStateResponse'];

export interface VotePatch {
  readonly viewerHasVoted: boolean;
  readonly voteCount: number;
}

export interface Votable {
  readonly id: string;
  readonly voteCount: number;
  readonly viewerHasVoted: boolean;
}

@Injectable({ providedIn: 'root' })
export class VoteService {
  private readonly http = inject(HttpClient);
  private readonly inFlight = new Set<string>();

  public isVoting(id: string): boolean {
    return this.inFlight.has(id);
  }

  public async vote(item: Votable, apply: (patch: VotePatch) => void): Promise<ApiError | null> {
    if (this.inFlight.has(item.id)) {
      return null;
    }

    this.inFlight.add(item.id);
    const before: VotePatch = { viewerHasVoted: item.viewerHasVoted, voteCount: item.voteCount };
    const removing = item.viewerHasVoted;

    apply({ viewerHasVoted: !removing, voteCount: item.voteCount + (removing ? -1 : 1) });

    try {
      const url = `/v1/requests/${item.id}/vote`;
      const answer = await firstValueFrom(
        removing ? this.http.delete<VoteState>(url) : this.http.post<VoteState>(url, null),
      );

      apply({ viewerHasVoted: answer.viewerHasVoted, voteCount: answer.voteCount });
      return null;
    } catch (cause) {
      apply(before);
      return toApiError(cause);
    } finally {
      this.inFlight.delete(item.id);
    }
  }
}
