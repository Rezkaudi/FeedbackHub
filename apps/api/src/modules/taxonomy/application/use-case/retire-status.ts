import { Inject, Injectable } from '@nestjs/common';
import { STATUS_REPOSITORY, StatusRepository } from '../port/taxonomy-repository';
import { Status } from '../../domain/entity/status';
import { NotFoundError } from '../../../../shared/errors/app-error';

/**
 * R-48: the first status cannot be retired. The entity itself refuses that, so
 * this use case only has to find the row.
 */
@Injectable()
export class RetireStatus {
  public constructor(@Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository) {}

  public async execute(statusId: string): Promise<Status> {
    const status = await this.statuses.findById(statusId);

    if (status === null) {
      throw new NotFoundError('Status', statusId);
    }

    status.retire();
    return this.statuses.save(status);
  }
}
