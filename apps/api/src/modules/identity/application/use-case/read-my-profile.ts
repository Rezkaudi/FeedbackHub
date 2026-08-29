import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../port/user-repository';
import { User } from '../../domain/entity/user';
import { NotFoundError } from '../../../../shared/errors/app-error';

/** Reads the saved row, never the token's copy of it (R-7). */
@Injectable()
export class ReadMyProfile {
  public constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  public async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);

    if (user === null || !user.isActive) {
      throw new NotFoundError('Account', userId);
    }

    return user;
  }
}
