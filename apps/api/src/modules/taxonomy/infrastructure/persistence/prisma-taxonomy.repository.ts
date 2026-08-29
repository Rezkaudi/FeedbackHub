import { Injectable } from '@nestjs/common';
import { Category as CategoryRow, Prisma, Status as StatusRow } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CategoryRepository, StatusRepository } from '../../application/port/taxonomy-repository';
import { Category } from '../../domain/entity/category';
import { Status } from '../../domain/entity/status';
import { DuplicateNameError } from '../../domain/error/taxonomy-errors';

/**
 * The only place in this module that knows Prisma exists (R-147).
 *
 * Rows are turned into entities on the way in and back into columns on the way
 * out, so a Prisma type never escapes into a use case or an HTTP response
 * (R-142). The dependency check fails the build if that ever stops being true.
 */

const UNIQUE_VIOLATION = 'P2002';

function toCategory(row: CategoryRow): Category {
  return Category.rehydrate({
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
  });
}

function toStatus(row: StatusRow): Status {
  return Status.rehydrate({
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt,
  });
}

/**
 * R-44 is kept by two unique indexes, one of them on `lower(name)`. Prisma
 * reports both as P2002, so the database's refusal is turned into the message
 * the admin should see rather than a 500.
 */
function asDuplicateName(error: unknown, what: 'category' | 'status'): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
    throw new DuplicateNameError(what);
  }
  throw error;
}

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  public constructor(private readonly prisma: PrismaService) {}

  /** R-49: created_at order, always. */
  public async listAll(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toCategory);
  }

  public async listActive(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toCategory);
  }

  public async findById(id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row === null ? null : toCategory(row);
  }

  public countActive(): Promise<number> {
    return this.prisma.category.count({ where: { isActive: true } });
  }

  public countRequestsUsing(id: string): Promise<number> {
    return this.prisma.feedbackRequest.count({ where: { categoryId: id } });
  }

  public async add(category: Category): Promise<Category> {
    const state = category.snapshot();

    try {
      const row = await this.prisma.category.create({
        data: {
          id: state.id,
          name: state.name,
          slug: state.slug,
          color: state.color,
          description: state.description,
          isActive: state.isActive,
        },
      });
      return toCategory(row);
    } catch (error) {
      return asDuplicateName(error, 'category');
    }
  }

  public async save(category: Category): Promise<Category> {
    const state = category.snapshot();

    try {
      const row = await this.prisma.category.update({
        where: { id: state.id },
        data: {
          name: state.name,
          slug: state.slug,
          color: state.color,
          description: state.description,
          isActive: state.isActive,
        },
      });
      return toCategory(row);
    } catch (error) {
      return asDuplicateName(error, 'category');
    }
  }

  public async remove(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }
}

@Injectable()
export class PrismaStatusRepository implements StatusRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async listAll(): Promise<Status[]> {
    const rows = await this.prisma.status.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toStatus);
  }

  public async listActive(): Promise<Status[]> {
    const rows = await this.prisma.status.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toStatus);
  }

  public async findById(id: string): Promise<Status | null> {
    const row = await this.prisma.status.findUnique({ where: { id } });
    return row === null ? null : toStatus(row);
  }

  public async findDefault(): Promise<Status | null> {
    const row = await this.prisma.status.findFirst({ where: { isDefault: true } });
    return row === null ? null : toStatus(row);
  }

  public countRequestsUsing(id: string): Promise<number> {
    return this.prisma.feedbackRequest.count({ where: { statusId: id } });
  }

  public async add(status: Status): Promise<Status> {
    const state = status.snapshot();

    try {
      const row = await this.prisma.status.create({
        data: {
          id: state.id,
          name: state.name,
          slug: state.slug,
          color: state.color,
          isDefault: state.isDefault,
          isActive: state.isActive,
        },
      });
      return toStatus(row);
    } catch (error) {
      return asDuplicateName(error, 'status');
    }
  }

  public async save(status: Status): Promise<Status> {
    const state = status.snapshot();

    try {
      const row = await this.prisma.status.update({
        where: { id: state.id },
        // isDefault is deliberately not written here. Moving the first status is
        // moveDefaultTo(), which does it as one step (R-47).
        data: {
          name: state.name,
          slug: state.slug,
          color: state.color,
          isActive: state.isActive,
        },
      });
      return toStatus(row);
    } catch (error) {
      return asDuplicateName(error, 'status');
    }
  }

  public async remove(id: string): Promise<void> {
    await this.prisma.status.delete({ where: { id } });
  }

  /**
   * R-47, in one transaction: stand the old one down, then mark the new one.
   *
   * The order matters. A partial unique index means two rows can never both be
   * the first status, so marking the new one first would be refused by the
   * database. Doing it the other way leaves *no* first status for the length of
   * the transaction, which nothing outside it can observe.
   */
  public async moveDefaultTo(statusId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.status.updateMany({
        where: { isDefault: true, id: { not: statusId } },
        data: { isDefault: false },
      });
      await tx.status.update({ where: { id: statusId }, data: { isDefault: true } });
    });
  }
}
