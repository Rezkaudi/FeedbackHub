import { Inject, Injectable } from '@nestjs/common';
import { STATUS_REPOSITORY, StatusRepository } from '../port/taxonomy-repository';
import { Status } from '../../domain/entity/status';
import { NotFoundError } from '../../../../shared/errors/app-error';

/** R-44: rename and recolour a status. The first-status mark is changed elsewhere. */
@Injectable()
export class ChangeStatus {
  public constructor(@Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository) {}

  public async execute(
    statusId: string,
    changes: { name?: string; color?: string; isActive?: boolean },
  ): Promise<Status> {
    const status = await this.statuses.findById(statusId);

    if (status === null) {
      throw new NotFoundError('Status', statusId);
    }

    if (changes.name !== undefined) {
      status.rename(changes.name);
    }
    if (changes.color !== undefined) {
      status.recolour(changes.color);
    }
    if (changes.isActive === true) {
      status.bringBack();
    }

    return this.statuses.save(status);
  }
}
