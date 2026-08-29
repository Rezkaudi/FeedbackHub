import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * A real Postgres 16 with the real migrations applied. This is the only thing
 * that can prove "the database stops it" (R-145, R-158) — a mocked repository
 * would pass happily with the constraint missing.
 *
 * The migration is run with `prisma migrate deploy`, the same command the
 * container entrypoint uses (R-82), so what the tests check is what ships.
 */
export interface TestDatabase {
  readonly prisma: PrismaClient;
  readonly url: string;
  /** A real Redis 7, because R-158 says integration tests use one. */
  readonly redisUrl: string;
  stop(): Promise<void>;
  truncate(): Promise<void>;
}

const API_ROOT = join(__dirname, '..', '..');

export async function startTestDatabase(): Promise<TestDatabase> {
  const [container, redis]: [StartedPostgreSqlContainer, StartedRedisContainer] = await Promise.all(
    [new PostgreSqlContainer('postgres:16-alpine').start(), new RedisContainer('redis:7-alpine').start()],
  );

  const url = container.getConnectionUri();

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();

  return {
    prisma,
    url,
    redisUrl: redis.getConnectionUrl(),
    async stop(): Promise<void> {
      await prisma.$disconnect();
      await Promise.all([container.stop(), redis.stop()]);
    },
    /**
     * Between tests. Every table except app_settings, which is a single seeded
     * row the app always expects to find.
     */
    async truncate(): Promise<void> {
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          votes, comments, feedback_requests,
          user_settings, users,
          categories, statuses, invitations
        RESTART IDENTITY CASCADE
      `);
    },
  };
}
