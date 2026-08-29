import { Inject, Injectable } from '@nestjs/common';
import {
  INVITATION_REPOSITORY,
  InvitationRepository,
} from './application/port/invitation-repository';

/**
 * The published service (R-141). `identity` is the only caller: it asks whether
 * an address may join under the invite-only rule (R-67), and marks the
 * invitation used once the person really exists (R-4).
 */
@Injectable()
export class InvitationsService {
  public constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
  ) {}

  /**
   * An invitation that has already been accepted does not let a *second*
   * account in on the same address — though the unique index on users.email
   * would stop that anyway.
   */
  public async hasOpenInvitationFor(email: string): Promise<boolean> {
    const invitation = await this.invitations.findByEmail(email);
    return invitation !== null && !invitation.isAccepted;
  }

  public async markAccepted(email: string, at: Date): Promise<void> {
    const invitation = await this.invitations.findByEmail(email);

    if (invitation !== null && !invitation.isAccepted) {
      invitation.accept(at);
      await this.invitations.save(invitation);
    }
  }
}
