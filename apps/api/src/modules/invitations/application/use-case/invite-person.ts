import { Inject, Injectable } from '@nestjs/common';
import { INVITATION_REPOSITORY, InvitationRepository } from '../port/invitation-repository';
import { Invitation } from '../../domain/entity/invitation';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/ports';
import { ConflictError } from '../../../../shared/errors/app-error';

/** R-66: only an admin can add an invitation. The guard chain proves that. */
@Injectable()
export class InvitePerson {
  public constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  public async execute(email: string): Promise<Invitation> {
    const invitation = Invitation.create(email, this.ids.next());

    // Inviting the same address twice is a mistake worth naming rather than a
    // silent no-op: the admin probably expected a second email to go out.
    if ((await this.invitations.findByEmail(invitation.email)) !== null) {
      throw new ConflictError('That address has already been invited.');
    }

    return this.invitations.add(invitation);
  }
}
