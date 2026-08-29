import { Inject, Injectable } from '@nestjs/common';
import { REQUEST_REPOSITORY, RequestRepository } from '../port/request-repository';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';
import { loadOwnedOrAdmin } from './request-permissions';

/**
 * R-14: the person who wrote it can delete it; an admin can delete any.
 * Deleting removes its votes and its comments too — by cascade in the database,
 * so it cannot be half done.
 *
 * The confirmation that says what will be lost is the screen's job; the server
 * only has to be sure who is asking.
 */
@Injectable()
export class DeleteRequest {
  public constructor(@Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository) {}

  public async execute(requestId: string, user: AuthenticatedUser): Promise<void> {
    loadOwnedOrAdmin(await this.requests.findById(requestId), requestId, user);
    await this.requests.remove(requestId);
  }
}
