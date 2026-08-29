import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY, RequestRepository } from '../port/request-repository';
import { FeedbackRequest } from '../../domain/entity/feedback-request';
import { TaxonomyService } from '../../../taxonomy/taxonomy.service';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';
import { loadOwnedOrAdmin } from './request-permissions';
import { ValidationFailedError } from '../../../../shared/errors/app-error';

/**
 * R-13: the person who wrote it can change the title, text and category. An
 * admin can change any request.
 *
 * The status is deliberately not editable here — that is an admin-only act with
 * its own use case (R-64), and the edit screen does not show it (SRS part 7).
 */
@Injectable()
export class EditRequest {
  public constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
    private readonly taxonomy: TaxonomyService,
  ) {}

  public async execute(
    requestId: string,
    changes: { title?: string; description?: string; categoryId?: string },
    user: AuthenticatedUser,
  ): Promise<FeedbackRequest> {
    const request = loadOwnedOrAdmin(await this.requests.findById(requestId), requestId, user);

    if (changes.categoryId !== undefined) {
      const { categories } = await this.taxonomy.activeLists();
      if (!categories.some((category) => category.id === changes.categoryId)) {
        throw new ValidationFailedError({ categoryId: 'CATEGORY_MUST_EXIST_AND_BE_ACTIVE' });
      }
    }

    request.edit(changes);
    return this.requests.save(request);
  }
}
