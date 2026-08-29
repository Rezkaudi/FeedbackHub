import { Inject, Injectable } from '@nestjs/common';
import { STATUS_REPOSITORY, StatusRepository } from '../port/taxonomy-repository';
import { Status } from '../../domain/entity/status';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/ports';

/** R-43, R-44. A new status is never the first one: see MakeStatusDefault (R-47). */
@Injectable()
export class AddStatus {
  public constructor(
    @Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  public execute(input: { name: string; color: string }): Promise<Status> {
    return this.statuses.add(Status.create(input, this.ids.next()));
  }
}
