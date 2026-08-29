import { Category } from '../../domain/entity/category';
import { Status } from '../../domain/entity/status';

/**
 * The ports the taxonomy use cases speak to (R-147). The Prisma versions live in
 * `infrastructure/` and are the only place that knows an ORM exists — so the use
 * cases below are testable with no database at all.
 */

export interface CategoryRepository {
  /** R-49: read in created_at order. */
  listAll(): Promise<Category[]>;
  listActive(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  countActive(): Promise<number>;
  /** How many requests use it — the admin screen shows this (SRS part 7). */
  countRequestsUsing(id: string): Promise<number>;
  save(category: Category): Promise<Category>;
  add(category: Category): Promise<Category>;
  remove(id: string): Promise<void>;
}

export interface StatusRepository {
  listAll(): Promise<Status[]>;
  listActive(): Promise<Status[]>;
  findById(id: string): Promise<Status | null>;
  findDefault(): Promise<Status | null>;
  countRequestsUsing(id: string): Promise<number>;
  save(status: Status): Promise<Status>;
  add(status: Status): Promise<Status>;
  remove(id: string): Promise<void>;
  /**
   * R-47: marking a new first status un-marks the old one, in the same step.
   * One method, because two calls could leave the app with none or with two.
   */
  moveDefaultTo(statusId: string): Promise<void>;
}

export const CATEGORY_REPOSITORY = Symbol('CategoryRepository');
export const STATUS_REPOSITORY = Symbol('StatusRepository');
