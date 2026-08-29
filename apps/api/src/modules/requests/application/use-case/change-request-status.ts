import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY, RequestRepository } from '../port/request-repository';
import { FeedbackRequest } from '../../domain/entity/feedback-request';
import { TaxonomyService } from '../../../taxonomy/taxonomy.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { loadExisting } from './request-permissions';
import { ValidationFailedError } from '../../../../shared/errors/app-error';

/**
 * R-64: only an admin changes a status, and it shows at once everywhere the
 * request appears. The admin-only part is the guard chain's job; this use case
 * assumes it has already said yes.
 *
 * R-73/R-74: the author is emailed *after* the change is saved, in a background
 * job. A mail problem can never undo a status change (R-72), which is why the
 * enqueue is the last thing and its failure is swallowed by the notifications
 * module rather than raised here.
 */
@Injectable()
export class ChangeRequestStatus {
  public constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
    private readonly taxonomy: TaxonomyService,
    private readonly notifications: NotificationsService,
  ) {}

  public async execute(
    requestId: string,
    statusId: string,
    actorId: string,
  ): Promise<FeedbackRequest> {
    const request = loadExisting(await this.requests.findById(requestId), requestId);

    const { statuses } = await this.taxonomy.activeLists();
    const status = statuses.find((candidate) => candidate.id === statusId);

    if (status === undefined) {
      throw new ValidationFailedError({ statusId: 'STATUS_MUST_EXIST_AND_BE_ACTIVE' });
    }

    const unchanged = request.statusId === statusId;
    request.moveTo(statusId);
    const saved = await this.requests.save(request);

    // R-71: nobody is told about their own action, and only if they asked for
    // it. Both checks live in the notifications module.
    if (!unchanged) {
      await this.notifications.requestStatusChanged({
        requestId: saved.id,
        requestTitle: saved.title,
        authorId: saved.authorId,
        actorId,
        newStatusName: status.name,
      });
    }

    return saved;
  }
}
