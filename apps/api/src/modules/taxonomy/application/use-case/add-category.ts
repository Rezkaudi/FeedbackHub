import { Inject, Injectable } from '@nestjs/common';
import { CATEGORY_REPOSITORY, CategoryRepository } from '../port/taxonomy-repository';
import { Category } from '../../domain/entity/category';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/ports';

/** R-44: the admin adds a category. Two cannot share a name — the database says so. */
@Injectable()
export class AddCategory {
  public constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  public execute(input: {
    name: string;
    color: string;
    description?: string | null;
  }): Promise<Category> {
    return this.categories.add(Category.create(input, this.ids.next()));
  }
}
