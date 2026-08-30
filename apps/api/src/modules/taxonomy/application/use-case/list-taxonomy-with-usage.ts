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
 * The admin's view of the two lists: every row, retired ones included, each with
 * the number of requests using it (SRS part 7).
 *
 * It is its own use case rather than a flag on ListTaxonomy because it answers a
 * different question for a different screen — everybody else reads the lists to
 * fill a picker and has no business counting requests (R-151).
 *
 * The four reads run together: the counts do not depend on the rows, so waiting
 * for one before starting the other would only add latency.
 */
export interface TaxonomyUsage {
  readonly categories: readonly { readonly row: Category; readonly usageCount: number }[];
  readonly statuses: readonly { readonly row: Status; readonly usageCount: number }[];
}

@Injectable()
export class ListTaxonomyWithUsage {
  public constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository,
  ) {}

  public async execute(): Promise<TaxonomyUsage> {
    const [categories, statuses, categoryUsage, statusUsage] = await Promise.all([
      this.categories.listAll(),
      this.statuses.listAll(),
      this.categories.usageCounts(),
      this.statuses.usageCounts(),
    ]);

    return {
      // Absent from the map means nothing uses it, which is zero, not unknown.
      categories: categories.map((row) => ({ row, usageCount: categoryUsage.get(row.id) ?? 0 })),
      statuses: statuses.map((row) => ({ row, usageCount: statusUsage.get(row.id) ?? 0 })),
    };
  }
}
