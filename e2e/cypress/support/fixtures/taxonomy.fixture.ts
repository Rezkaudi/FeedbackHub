import { api } from '../clients/api.client';
import { ADMIN } from './accounts';
import type { AdminCategory, AdminStatus } from '../utils/types';

/**
 * Snapshots the whole taxonomy, runs `body`, and restores it: deletes
 * anything created, un-retires anything retired, and puts the original
 * default status back. Specs that add/retire/delete categories or statuses
 * wrap their scenario in this rather than cleaning up by hand.
 */
export function withTaxonomy(body: () => void): void {
  let before_: { categories: AdminCategory[]; statuses: AdminStatus[] } | null = null;

  before(() => {
    cy.signIn(ADMIN);
    api.taxonomy.read().then((snapshot) => {
      before_ = snapshot as unknown as { categories: AdminCategory[]; statuses: AdminStatus[] };
    });
  });

  after(() => {
    if (before_ === null) {
      return;
    }
    cy.signIn(ADMIN);

    const originalDefaultStatus = before_.statuses.find((s) => s.isDefault);
    const originalCategoryIds = new Set(before_.categories.map((c) => c.id));
    const originalStatusIds = new Set(before_.statuses.map((s) => s.id));
    const originalActiveCategoryIds = new Set(before_.categories.filter((c) => c.isActive).map((c) => c.id));
    const originalActiveStatusIds = new Set(before_.statuses.filter((s) => s.isActive).map((s) => s.id));

    api.taxonomy.read().then((now) => {
      const nowCategories = now.categories as unknown as AdminCategory[];
      const nowStatuses = now.statuses as unknown as AdminStatus[];

      for (const category of nowCategories) {
        if (!originalCategoryIds.has(category.id)) {
          api.taxonomy.categories.remove(category.id);
        } else if (originalActiveCategoryIds.has(category.id) && !category.isActive) {
          api.taxonomy.categories.update(category.id, { isActive: true });
        }
      }

      for (const status of nowStatuses) {
        if (!originalStatusIds.has(status.id)) {
          api.taxonomy.statuses.remove(status.id);
        } else if (originalActiveStatusIds.has(status.id) && !status.isActive) {
          api.taxonomy.statuses.update(status.id, { isActive: true });
        }
      }

      if (originalDefaultStatus) {
        api.taxonomy.statuses.makeDefault(originalDefaultStatus.id);
      }
    });
  });

  body();
}
