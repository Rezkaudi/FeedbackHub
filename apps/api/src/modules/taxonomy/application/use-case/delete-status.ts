import { Inject, Injectable } from '@nestjs/common';
import { STATUS_REPOSITORY, StatusRepository } from '../port/taxonomy-repository';
import { StatusInUseError, DefaultStatusCannotBeRetiredError } from '../../domain/error/taxonomy-errors';
import { NotFoundError } from '../../../../shared/errors/app-error';

/** R-46: a status used by any request cannot be deleted. Only retiring is possible. */
@Injectable()
export class DeleteStatus {
  public constructor(@Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository) {}

  public async execute(statusId: string): Promise<void> {
    const status = await this.statuses.findById(statusId);

    if (status === null) {
      throw new NotFoundError('Status', statusId);
    }

    // Deleting the first status would leave new requests with nowhere to start,
    // which is the same harm R-48 guards against for retiring.
    if (status.isDefault) {
      throw new DefaultStatusCannotBeRetiredError();
    }

    if ((await this.statuses.countRequestsUsing(statusId)) > 0) {
      throw new StatusInUseError();
    }

    await this.statuses.remove(statusId);
  }
}
