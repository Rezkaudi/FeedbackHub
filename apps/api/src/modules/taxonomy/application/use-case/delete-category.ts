import { Inject, Injectable } from '@nestjs/common';
import { CATEGORY_REPOSITORY, CategoryRepository } from '../port/taxonomy-repository';
import { CategoryInUseError } from '../../domain/error/taxonomy-errors';
import { NotFoundError } from '../../../../shared/errors/app-error';

/**
 * R-46: a category used by any request cannot be deleted. Only retiring is
 * possible.
 *
 * The count here is a kindness, not the guarantee: it lets us answer with a
 * message that says what to do instead. The guarantee is the foreign key, which
 * refuses the delete even if this check is skipped or loses a race (R-115).
 */
@Injectable()
export class DeleteCategory {
  public constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  public async execute(categoryId: string): Promise<void> {
    const category = await this.categories.findById(categoryId);

    if (category === null) {
      throw new NotFoundError('Category', categoryId);
    }

    if ((await this.categories.countRequestsUsing(categoryId)) > 0) {
      throw new CategoryInUseError();
    }

    await this.categories.remove(categoryId);
  }
}
