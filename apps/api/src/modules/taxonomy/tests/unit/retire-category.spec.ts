import { RetireCategory } from '../../application/use-case/retire-category';
import { DeleteCategory } from '../../application/use-case/delete-category';
import { Category } from '../../domain/entity/category';
import { CategoryRepository } from '../../application/port/taxonomy-repository';
import {
  CategoryInUseError,
  LastActiveCategoryError,
} from '../../domain/error/taxonomy-errors';
import { NotFoundError } from '../../../../shared/errors/app-error';

/**
 * R-48: the last active category cannot be retired — otherwise nobody could
 * write a request.
 * R-46: a category in use cannot be deleted. Only retired.
 *
 * Both are proved here with fake ports, and again against a real Postgres in the
 * integration tests. They are not the same proof: this says the use case refuses
 * politely, that one says the database refuses even if this code is bypassed.
 */
const aCategory = (id: string, isActive = true): Category =>
  Category.rehydrate({
    id,
    name: `Category ${id}`,
    slug: `category-${id}`,
    color: '#123456',
    description: null,
    isActive,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });

class FakeCategoryRepository implements CategoryRepository {
  public readonly saved: Category[] = [];
  public readonly removed: string[] = [];

  public constructor(
    private readonly categories: Category[],
    private readonly requestsUsing: Record<string, number> = {},
  ) {}

  public listAll(): Promise<Category[]> {
    return Promise.resolve(this.categories);
  }
  public listActive(): Promise<Category[]> {
    return Promise.resolve(this.categories.filter((c) => c.isActive));
  }
  public findById(id: string): Promise<Category | null> {
    return Promise.resolve(this.categories.find((c) => c.id === id) ?? null);
  }
  public countActive(): Promise<number> {
    return Promise.resolve(this.categories.filter((c) => c.isActive).length);
  }
  public countRequestsUsing(id: string): Promise<number> {
    return Promise.resolve(this.requestsUsing[id] ?? 0);
  }
  public save(category: Category): Promise<Category> {
    this.saved.push(category);
    return Promise.resolve(category);
  }
  public add(category: Category): Promise<Category> {
    this.categories.push(category);
    return Promise.resolve(category);
  }
  public remove(id: string): Promise<void> {
    this.removed.push(id);
    return Promise.resolve();
  }
}

describe('RetireCategory', () => {
  it('retires one when others are still active', async () => {
    const repository = new FakeCategoryRepository([aCategory('a'), aCategory('b')]);

    await new RetireCategory(repository).execute('a');

    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0]?.isActive).toBe(false);
  });

  it('refuses to retire the only active one, so a request can always be written (R-48)', async () => {
    const repository = new FakeCategoryRepository([aCategory('a'), aCategory('b', false)]);

    await expect(new RetireCategory(repository).execute('a')).rejects.toBeInstanceOf(
      LastActiveCategoryError,
    );
    expect(repository.saved).toHaveLength(0);
  });

  it('says not found rather than pretending, when the id is unknown', async () => {
    const repository = new FakeCategoryRepository([]);

    await expect(new RetireCategory(repository).execute('missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('leaves an already-retired category alone without counting it as the last one', async () => {
    const repository = new FakeCategoryRepository([aCategory('a'), aCategory('b', false)]);

    await new RetireCategory(repository).execute('b');

    expect(repository.saved[0]?.isActive).toBe(false);
  });
});

describe('DeleteCategory', () => {
  it('deletes one that nothing uses', async () => {
    const repository = new FakeCategoryRepository([aCategory('a'), aCategory('b')]);

    await new DeleteCategory(repository).execute('a');

    expect(repository.removed).toEqual(['a']);
  });

  it('refuses to delete one that requests use, and offers retiring instead (R-46)', async () => {
    const repository = new FakeCategoryRepository([aCategory('a')], { a: 3 });

    const failure = new DeleteCategory(repository).execute('a');

    await expect(failure).rejects.toBeInstanceOf(CategoryInUseError);
    await expect(failure).rejects.toThrow(/Retire it instead/);
    expect(repository.removed).toHaveLength(0);
  });
});
