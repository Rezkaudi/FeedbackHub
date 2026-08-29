import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY, RequestRepository } from '../port/request-repository';
import { FeedbackRequest } from '../../domain/entity/feedback-request';
import { TaxonomyService } from '../../../taxonomy/taxonomy.service';
import { SettingsService } from '../../../settings/settings.service';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '../../../../shared/ports';
import { ValidationFailedError, ConflictError } from '../../../../shared/errors/app-error';

/**
 * R-10, R-11, R-12: the person picks a title, a description and a category. The
 * server sets the status, the author, the time and the counts.
 *
 * The category must exist **and be active** (R-12). SRS 15.3 names the case: the
 * category was retired while the form was open, and the person gets a clear
 * message asking them to pick another rather than a foreign-key error.
 */
@Injectable()
export class SubmitRequest {
  public constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
    private readonly taxonomy: TaxonomyService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  public async execute(
    input: { title: string; description: string; categoryId: string },
    authorId: string,
  ): Promise<FeedbackRequest> {
    const { categories, statuses } = await this.taxonomy.activeLists();

    const category = categories.find((c) => c.id === input.categoryId);
    if (category === undefined) {
      throw new ValidationFailedError({ categoryId: 'CATEGORY_MUST_EXIST_AND_BE_ACTIVE' });
    }

    // R-11: the status marked as the first one. R-48 guarantees one exists; if
    // it does not, writing a request is impossible and saying so plainly beats
    // a foreign-key error.
    const firstStatus = statuses.find((status) => status.isDefault);
    if (firstStatus === undefined) {
      throw new ConflictError(
        'No status is marked as the first one, so a request cannot be created yet.',
      );
    }

    const request = FeedbackRequest.submit(input, {
      authorId,
      statusId: firstStatus.id,
      id: this.ids.next(),
    });

    const { submissionLimit } = await this.settings.appSettings();

    return this.requests.createWithinSubmissionLimit(
      request,
      submissionLimit,
      this.clock.now(),
    );
  }
}
