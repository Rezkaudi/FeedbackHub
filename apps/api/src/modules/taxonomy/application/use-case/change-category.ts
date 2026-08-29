import { Inject, Injectable } from '@nestjs/common';
import { CATEGORY_REPOSITORY, CategoryRepository } from '../port/taxonomy-repository';
import { Category } from '../../domain/entity/category';
import { NotFoundError } from '../../../../shared/errors/app-error';

/** R-44: add, rename and recolour. Bringing a retired one back is the same act. */
@Injectable()
export class ChangeCategory {
  public constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  public async execute(
    categoryId: string,
    changes: {
      name?: string;
      color?: string;
      description?: string | null;
      isActive?: boolean;
    },
  ): Promise<Category> {
    const category = await this.categories.findById(categoryId);

    if (category === null) {
      throw new NotFoundError('Category', categoryId);
    }

    if (changes.name !== undefined) {
      category.rename(changes.name);
    }
    if (changes.color !== undefined) {
      category.recolour(changes.color);
    }
    if (changes.description !== undefined) {
      category.describe(changes.description);
    }
    // Retiring goes through RetireCategory, which knows about the last-one rule
    // (R-48). Only bringing one back is done here.
    if (changes.isActive === true) {
      category.bringBack();
    }

    return this.categories.save(category);
  }
}
