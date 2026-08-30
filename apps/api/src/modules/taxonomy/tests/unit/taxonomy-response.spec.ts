import { AdminCategoryResponse, AdminStatusResponse } from '../../http/dto/taxonomy.dto';
import { Category } from '../../domain/entity/category';
import { Status } from '../../domain/entity/status';

/**
 * SRS part 7: the admin screen for categories and statuses "shows how many
 * requests use each one".
 *
 * It is the number that makes the screen safe to use. Deleting a row that is in
 * use is refused by the database (R-46), and retiring is the only way out — but
 * an admin who cannot see the count has no way to tell, before clicking, which
 * of the two they are about to be told to do.
 */
describe('a category or status on the admin screen', () => {
  const category = Category.rehydrate({
    id: 'c1',
    name: 'Bug',
    slug: 'bug',
    color: '#DC2626',
    description: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const status = Status.rehydrate({
    id: 's1',
    name: 'New',
    slug: 'new',
    color: '#0369A1',
    isDefault: true,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  it('says how many requests use the category', () => {
    expect(AdminCategoryResponse.fromWithUsage(category, 12).usageCount).toBe(12);
  });

  it('says how many requests use the status', () => {
    expect(AdminStatusResponse.fromWithUsage(status, 4).usageCount).toBe(4);
  });

  it('says zero for one nothing uses, so the admin knows it can be deleted', () => {
    expect(AdminCategoryResponse.fromWithUsage(category, 0).usageCount).toBe(0);
  });
});
