import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY, RequestRepository } from '../port/request-repository';
import { BoardRow } from '../../domain/entity/board-query';
import { SettingsService } from '../../../settings/settings.service';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';
import { NotFoundError } from '../../../../shared/errors/app-error';

/**
 * One request, with the same derived counts the board shows, so the two screens
 * can never disagree (R-28). Reusing the board query with a filter of one is
 * deliberate: a second, subtly different count is exactly the kind of drift
 * R-150 exists to prevent.
 */
@Injectable()
export class ReadRequest {
  public constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
    private readonly settings: SettingsService,
  ) {}

  public async execute(requestId: string, viewer: AuthenticatedUser): Promise<BoardRow> {
    const commentsEnabled = await this.settings.commentsAreEnabled();

    const row = await this.requests.boardRow(
      requestId,
      { id: viewer.id, isAdmin: viewer.role === 'admin' },
      commentsEnabled,
    );

    // SRS 15.2: deleted while it was open, or a bad address — the same clear
    // "this does not exist any more" either way.
    if (row === null) {
      throw new NotFoundError('Feedback request', requestId);
    }

    return row;
  }
}
