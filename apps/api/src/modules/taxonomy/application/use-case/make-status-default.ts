import { Inject, Injectable } from '@nestjs/common';
import { STATUS_REPOSITORY, StatusRepository } from '../port/taxonomy-repository';
import { NotFoundError } from '../../../../shared/errors/app-error';
import { RetiredStatusCannotBeDefaultError } from '../../domain/error/taxonomy-errors';

/**
 * R-47: exactly one status is marked as the first one, and marking a new one
 * un-marks the old one **in the same step**.
 *
 * That is one repository call, not two, because between two calls the app would
 * briefly have no first status — and the database's partial unique index would
 * refuse the second write anyway if the order came out wrong.
 */
@Injectable()
export class MakeStatusDefault {
  public constructor(@Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository) {}

  public async execute(statusId: string): Promise<void> {
    const status = await this.statuses.findById(statusId);

    if (status === null) {
      throw new NotFoundError('Status', statusId);
    }

    if (!status.isActive) {
      throw new RetiredStatusCannotBeDefaultError();
    }

    await this.statuses.moveDefaultTo(statusId);
  }
}
