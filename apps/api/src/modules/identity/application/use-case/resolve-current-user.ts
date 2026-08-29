import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../port/user-repository';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';
import { User } from '../../domain/entity/user';

/**
 * R-7, R-8: the server decides "is this allowed" by reading the **saved row**,
 * never by trusting an id or a role sent in the request. So the token tells us
 * only *which* row to read; everything the guard chain then compares comes from
 * the database.
 *
 * A wiped account (R-61) resolves to nobody, which is how "their sign-in stops
 * working" is true even while their old token is still inside its five minutes.
 */
@Injectable()
export class ResolveCurrentUser {
  public constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  public async execute(externalId: string): Promise<AuthenticatedUser | null> {
    const user = await this.users.findByExternalId(externalId);

    if (user === null || !user.isActive) {
      return null;
    }

    return toAuthenticatedUser(user);
  }
}

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
  };
}
