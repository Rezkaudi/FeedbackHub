import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY, RequestRepository } from './application/port/request-repository';

/**
 * The published service (R-141). `comments` and `votes` need to know a request
 * exists and who wrote it — for the "nobody is told about their own action" rule
 * (R-71) and to refuse a comment on a request that was just deleted (SRS 15.5).
 * Neither reads `feedback_requests` itself.
 */
@Injectable()
export class RequestsService {
  public constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
  ) {}

  public async summaryOf(
    requestId: string,
  ): Promise<{ id: string; title: string; authorId: string } | null> {
    const request = await this.requests.findById(requestId);

    if (request === null) {
      return null;
    }

    return { id: request.id, title: request.title, authorId: request.authorId };
  }
}
