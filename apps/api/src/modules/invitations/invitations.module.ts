import { Module } from '@nestjs/common';
import { InvitationsController } from './http/invitations.controller';
import { InvitationsService } from './invitations.service';
import { INVITATION_REPOSITORY } from './application/port/invitation-repository';
import { REGISTERED_PEOPLE } from './application/port/registered-people';
import { PrismaInvitationRepository } from './infrastructure/persistence/prisma-invitation.repository';
import { IdentityRegisteredPeople } from './infrastructure/identity/identity-registered-people';
import { InvitePerson } from './application/use-case/invite-person';
import { ListInvitations } from './application/use-case/list-invitations';
import { CancelInvitation } from './application/use-case/cancel-invitation';

/** Owns the `invitations` table. Nothing else touches it (R-141). */
@Module({
  controllers: [InvitationsController],
  providers: [
    { provide: INVITATION_REPOSITORY, useClass: PrismaInvitationRepository },
    { provide: REGISTERED_PEOPLE, useClass: IdentityRegisteredPeople },
    InvitePerson,
    ListInvitations,
    CancelInvitation,
    InvitationsService,
  ],
  exports: [InvitationsService],
})
export class InvitationsModule {}
