import { Inject, Injectable } from '@nestjs/common';
import { ReadMyProfile } from './application/use-case/read-my-profile';
import { PersonDisplay, UserView } from './contract';
import { USER_REPOSITORY, UserRepository } from './application/port/user-repository';

/**
 * The published service (R-141). `notifications` needs to know who to email and
 * `bootstrap` needs who I am; neither reads the `users` table itself.
 */
@Injectable()
export class IdentityService {
  public constructor(
    private readonly readMyProfile: ReadMyProfile,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  public async findActiveUser(userId: string): Promise<UserView> {
    const user = await this.readMyProfile.execute(userId);

    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      email: user.email,
      isActive: user.isActive,
    };
  }

  /**
   * The names and pictures to show beside other people's writing (R-99: never
   * their email). One query for the whole list, so rendering comments is never
   * N+1 (R-103). A wiped account comes back as "Deleted user" because that is
   * what its row now says (R-61).
   */
  public async displayFor(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, PersonDisplay>> {
    const users = await this.users.findManyByIds(userIds);

    return new Map(
      users.map((user) => [user.id, { displayName: user.displayName, avatarUrl: user.avatarUrl }]),
    );
  }
}
