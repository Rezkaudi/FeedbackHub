import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
  STATUS_REPOSITORY,
  StatusRepository,
} from '../port/taxonomy-repository';
import { Category } from '../../domain/entity/category';
import { Status } from '../../domain/entity/status';

/**
 * R-49: both lists come with the one start-up call, in created_at order. They
 * are not a separate call.
 *
 * `includeRetired` is the difference between the admin screen, which manages
 * retired rows, and everybody else, who only ever picks from the active ones
 * (R-45).
 */
@Injectable()
export class ListTaxonomy {
  public constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository,
  ) {}

  public async execute(options: { includeRetired: boolean }): Promise<{
    categories: Category[];
    statuses: Status[];
  }> {
    const [categories, statuses] = await Promise.all([
      options.includeRetired ? this.categories.listAll() : this.categories.listActive(),
      options.includeRetired ? this.statuses.listAll() : this.statuses.listActive(),
    ]);

    return { categories, statuses };
  }
}
