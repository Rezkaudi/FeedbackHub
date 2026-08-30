import { Injectable } from '@nestjs/common';
import { User as UserRow } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { UserRepository } from '../../application/port/user-repository';
import { User } from '../../domain/entity/user';
import { withinRateLimit } from '../../../../shared/rate-limit/sliding-window';

function toUser(row: UserRow): User {
  return User.rehydrate({
    id: row.id,
    externalId: row.externalId,
    email: row.email,
    emailVerified: row.emailVerified,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  });
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findByExternalId(externalId: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { externalId } });
    return row === null ? null : toUser(row);
  }

  public async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row === null ? null : toUser(row);
  }

  public async findManyByIds(ids: readonly string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.user.findMany({ where: { id: { in: [...ids] } } });
    return rows.map(toUser);
  }

  public countActiveAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { role: 'admin', status: 'active' } });
  }

  public async save(user: User): Promise<User> {
    const state = user.snapshot();
    const row = await this.prisma.user.update({
      where: { id: state.id },
      // `role` is not written here. Promoting someone is a separate, deliberate
      // act; a profile save must never be able to change it (R-8).
      data: {
        externalId: state.externalId,
        email: state.email,
        emailVerified: state.emailVerified,
        displayName: state.displayName,
        avatarUrl: state.avatarUrl,
        status: state.status,
        deletedAt: state.deletedAt,
      },
    });
    return toUser(row);
  }

  /**
   * R-4 + R-130 + R-132 in one database step.
   *
   * The sign-up limit counts **for the whole app**, because at the moment
   * someone is joining there is no person to count against (R-130). That means
   * every sign-up queues on one lock key — acceptable, because it is a rare
   * event and the alternative is a limit that does not hold.
   *
   * Wiped accounts still count inside the window: they were real sign-ups, and
   * excluding them would let sign-up-and-delete walk around the limit, exactly
   * the loop R-131 closes for requests.
   */
  public async createWithinSignupLimit(
    user: User,
    limit: { count: number; minutes: number },
    now: Date,
  ): Promise<User> {
    const state = user.snapshot();

    return this.prisma.$transaction(async (tx) =>
      withinRateLimit(
        tx,
        { key: 'signup:all', code: 'SIGNUP_RATE_LIMITED', policy: limit },
        now,
        async (client, since) => {
          const rows = await client.$queryRaw<{ count: bigint; oldest: Date | null }[]>`
            SELECT count(*)::bigint AS count, min(created_at) AS oldest
            FROM users
            WHERE created_at >= ${since}
          `;
          return { count: Number(rows[0]?.count ?? 0), oldest: rows[0]?.oldest ?? null };
        },
        async (client) => {
          const row = await client.user.create({
            data: {
              id: state.id,
              externalId: state.externalId,
              email: state.email,
              emailVerified: state.emailVerified,
              displayName: state.displayName,
              avatarUrl: state.avatarUrl,
              role: state.role,
              status: state.status,
            },
          });
          return toUser(row);
        },
      ),
    );
  }

  /**
   * R-61, in one transaction: the votes go, the person is wiped, and their
   * requests and comments are left exactly where they are — the foreign keys
   * from those tables are RESTRICT, which is what keeps the row alive to be
   * shown as "Deleted user".
   */
  public async wipeAccount(user: User, at: Date): Promise<void> {
    user.wipe(at);
    const state = user.snapshot();

    await this.prisma.$transaction(async (tx) => {
      await tx.vote.deleteMany({ where: { userId: state.id } });
      // Their settings mean nothing without them, and go by cascade anyway;
      // removing them here makes the intent explicit rather than incidental.
      await tx.userSettings.deleteMany({ where: { userId: state.id } });
      await tx.user.update({
        where: { id: state.id },
        data: {
          externalId: state.externalId,
          email: state.email,
          emailVerified: false,
          displayName: state.displayName,
          avatarUrl: null,
          status: 'deleted',
          deletedAt: state.deletedAt,
        },
      });
    });
  }
}
