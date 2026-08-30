import { Injectable } from '@nestjs/common';
import { ListTaxonomy } from './application/use-case/list-taxonomy';
import { CategoryView, StatusView } from './contract';

/**
 * The one published service of this module (R-140, R-141).
 *
 * It returns the plain shapes of `contract.ts`, never entities: an entity is
 * this module's internal business, and handing one out would let another module
 * depend on invariants it cannot see. The dependency check enforces it.
 */
@Injectable()
export class TaxonomyService {
  public constructor(private readonly listTaxonomy: ListTaxonomy) {}

  /** The lists everyone picks from: active only (R-45), created_at order (R-49). */
  public async activeLists(): Promise<{
    categories: CategoryView[];
    statuses: StatusView[];
  }> {
    return this.lists({ includeRetired: false });
  }

  /**
   * Every row, retired ones included, each marked (R-45).
   *
   * The start-up call needs these: a request keeps pointing at the category it
   * was written under even after that category is retired, and a screen given
   * only the active rows cannot name it.
   */
  public async allLists(): Promise<{
    categories: CategoryView[];
    statuses: StatusView[];
  }> {
    return this.lists({ includeRetired: true });
  }

  private async lists(options: { includeRetired: boolean }): Promise<{
    categories: CategoryView[];
    statuses: StatusView[];
  }> {
    const { categories, statuses } = await this.listTaxonomy.execute(options);

    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        color: category.color,
        isActive: category.isActive,
      })),
      statuses: statuses.map((status) => ({
        id: status.id,
        name: status.name,
        slug: status.slug,
        color: status.color,
        isActive: status.isActive,
        isDefault: status.isDefault,
      })),
    };
  }
}
