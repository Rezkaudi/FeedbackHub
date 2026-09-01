import { Injectable } from '@nestjs/common';
import { RegisteredPeople } from '../../application/port/registered-people';
import { IdentityService } from '../../../identity/identity.service';

/**
 * Reads membership through the identity module's published service (R-141).
 * `invitations` never touches the `users` table, and this adapter is the seam.
 */
@Injectable()
export class IdentityRegisteredPeople implements RegisteredPeople {
  public constructor(private readonly identity: IdentityService) {}

  public isRegistered(email: string): Promise<boolean> {
    return this.identity.isEmailRegistered(email);
  }
}
