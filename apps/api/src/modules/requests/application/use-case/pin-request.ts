import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY, RequestRepository } from '../port/request-repository';
import { FeedbackRequest } from '../../domain/entity/feedback-request';
import { loadExisting } from './request-permissions';
import { CLOCK, type Clock } from '../../../../shared/ports';

/** R-65: only an admin pins or unpins. More than one request can be pinned. */
@Injectable()
export class PinRequest {
  public constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async execute(requestId: string, pinned: boolean): Promise<FeedbackRequest> {
    const request = loadExisting(await this.requests.findById(requestId), requestId);

    if (pinned) {
      request.pin(this.clock.now());
    } else {
      request.unpin();
    }

    return this.requests.save(request);
  }
}
