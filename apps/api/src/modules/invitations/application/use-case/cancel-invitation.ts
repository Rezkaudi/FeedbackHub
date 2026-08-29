import { Inject, Injectable } from '@nestjs/common';
import { INVITATION_REPOSITORY, InvitationRepository } from '../port/invitation-repository';
import { NotFoundError } from '../../../../shared/errors/app-error';

/** R-66: only an admin can remove an invitation. */
@Injectable()
export class CancelInvitation {
  public constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
  ) {}

  public async execute(invitationId: string): Promise<void> {
    if ((await this.invitations.findById(invitationId)) === null) {
      throw new NotFoundError('Invitation', invitationId);
    }

    await this.invitations.remove(invitationId);
  }
}
