import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../port/user-repository';
import { User } from '../../domain/entity/user';
import { NotFoundError } from '../../../../shared/errors/app-error';

/**
 * R-54: a person sets their display name and picture. No file upload — a picture
 * is a URL, and with none we draw their initials.
 *
 * The id comes from the guard chain, so there is no way to spell "change someone
 * else's profile" here (R-7).
 */
@Injectable()
export class ChangeMyProfile {
  public constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  public async execute(
    userId: string,
    changes: { displayName?: string; avatarUrl?: string | null },
  ): Promise<User> {
    const user = await this.users.findById(userId);

    if (user === null || !user.isActive) {
      throw new NotFoundError('Account', userId);
    }

    user.changeProfile(changes);
    return this.users.save(user);
  }
}
