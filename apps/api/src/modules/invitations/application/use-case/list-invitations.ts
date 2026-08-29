import { Inject, Injectable } from '@nestjs/common';
import { INVITATION_REPOSITORY, InvitationRepository } from '../port/invitation-repository';
import { Invitation } from '../../domain/entity/invitation';

/** R-66: only an admin can see the list. */
@Injectable()
export class ListInvitations {
  public constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
  ) {}

  public execute(): Promise<Invitation[]> {
    return this.invitations.listAll();
  }
}
