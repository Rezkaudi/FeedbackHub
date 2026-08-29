import { Module } from '@nestjs/common';
import { TaxonomyController } from './http/taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';
import {
  CATEGORY_REPOSITORY,
  STATUS_REPOSITORY,
} from './application/port/taxonomy-repository';
import {
  PrismaCategoryRepository,
  PrismaStatusRepository,
} from './infrastructure/persistence/prisma-taxonomy.repository';
import { ListTaxonomy } from './application/use-case/list-taxonomy';
import { AddCategory } from './application/use-case/add-category';
import { ChangeCategory } from './application/use-case/change-category';
import { RetireCategory } from './application/use-case/retire-category';
import { DeleteCategory } from './application/use-case/delete-category';
import { AddStatus } from './application/use-case/add-status';
import { ChangeStatus } from './application/use-case/change-status';
import { RetireStatus } from './application/use-case/retire-status';
import { DeleteStatus } from './application/use-case/delete-status';
import { MakeStatusDefault } from './application/use-case/make-status-default';

/**
 * Categories and statuses as data (R-43). This module owns those two tables and
 * nothing else touches them (R-141).
 *
 * Only TaxonomyService is exported: that is the seam.
 */
@Module({
  controllers: [TaxonomyController],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: STATUS_REPOSITORY, useClass: PrismaStatusRepository },
    ListTaxonomy,
    AddCategory,
    ChangeCategory,
    RetireCategory,
    DeleteCategory,
    AddStatus,
    ChangeStatus,
    RetireStatus,
    DeleteStatus,
    MakeStatusDefault,
    TaxonomyService,
  ],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
