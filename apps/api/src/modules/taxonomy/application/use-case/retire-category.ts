import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from '../port/taxonomy-repository';
import { LastActiveCategoryError } from '../../domain/error/taxonomy-errors';
import { NotFoundError } from '../../../../shared/errors/app-error';
import { Category } from '../../domain/entity/category';

/**
 * R-45: retire means gone from the picker, still shown correctly on old requests.
 * R-48: the last active category cannot be retired, or nobody could write a
 * request.
 *
 * The "last one" check reads the other rows, which is why it lives here and not
 * on the entity.
 */
@Injectable()
export class RetireCategory {
  public constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  public async execute(categoryId: string): Promise<Category> {
    const category = await this.categories.findById(categoryId);

    if (category === null) {
      throw new NotFoundError('Category', categoryId);
    }

    // Retiring one that is already retired changes nothing, and must not be
    // refused for being "the last active one" — it is not active.
    if (category.isActive && (await this.categories.countActive()) <= 1) {
      throw new LastActiveCategoryError();
    }

    category.retire();
    return this.categories.save(category);
  }
}
