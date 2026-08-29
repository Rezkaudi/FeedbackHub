import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../port/user-repository';
import { LastAdminCannotLeaveError } from '../../domain/error/identity-errors';
import { NotFoundError } from '../../../../shared/errors/app-error';
import { CLOCK, type Clock } from '../../../../shared/ports';

/**
 * R-61: their name, picture and email are wiped, their sign-in stops working,
 * their votes go. Their requests and comments stay, shown as "Deleted user".
 *
 * R-62: the last admin cannot delete their own account. The app must never be
 * left with nobody who can run it.
 *
 * The admin count and the wipe happen in one transaction inside the repository:
 * two admins deleting themselves at the same moment must not both see "there is
 * another admin" and both succeed.
 */
@Injectable()
export class DeleteMyAccount {
  public constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async execute(userId: string): Promise<void> {
    const user = await this.users.findById(userId);

    if (user === null || !user.isActive) {
      throw new NotFoundError('Account', userId);
    }

    if (user.isAdmin && (await this.users.countActiveAdmins()) <= 1) {
      throw new LastAdminCannotLeaveError();
    }

    await this.users.wipeAccount(user, this.clock.now());
  }
}
