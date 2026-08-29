import { PrismaClient } from '@prisma/client';
import { startTestDatabase, TestDatabase } from './database';

/**
 * SRS part 14 lists the promises that must hold no matter which screen or which
 * button caused it, and names who stops each one. Every promise whose column
 * says "Database" is proved here, against a real Postgres — because a check in
 * code and a check in the database are not the same strength when two things
 * happen in the same second (R-115, R-145).
 *
 * If one of these tests fails, the constraint is missing from the migration.
 * Code that "checks first" is not a substitute and must not be used to fix it.
 */
describe('the database keeps its promises', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;

  beforeAll(async () => {
    db = await startTestDatabase();
    prisma = db.prisma;
  }, 240000);

  afterAll(async () => {
    await db?.stop();
  });

  beforeEach(async () => {
    await db.truncate();
  });

  const aUser = async (email = 'person@example.com'): Promise<string> => {
    const user = await prisma.user.create({
      data: { externalId: `ext-${email}`, email, displayName: 'A Person' },
    });
    return user.id;
  };

  const aCategory = async (name = 'Bug'): Promise<string> => {
    const category = await prisma.category.create({
      data: { name, slug: name.toLowerCase(), color: '#ff0000' },
    });
    return category.id;
  };

  const aStatus = async (name = 'New', isDefault = true): Promise<string> => {
    const status = await prisma.status.create({
      data: { name, slug: name.toLowerCase().replace(/ /g, '-'), color: '#00ff00', isDefault },
    });
    return status.id;
  };

  const aRequest = async (authorId: string): Promise<string> => {
    const request = await prisma.feedbackRequest.create({
      data: {
        title: 'A good enough title',
        description: 'A description that is comfortably long enough.',
        categoryId: await aCategory(),
        statusId: await aStatus(),
        authorId,
      },
    });
    return request.id;
  };

  describe('one person, one vote per request (R-26)', () => {
    it('refuses a second vote from the same person, whatever the code does', async () => {
      const userId = await aUser();
      const requestId = await aRequest(userId);

      await prisma.vote.create({ data: { requestId, userId } });

      await expect(prisma.vote.create({ data: { requestId, userId } })).rejects.toThrow();
      await expect(prisma.vote.count({ where: { requestId } })).resolves.toBe(1);
    });

    it('survives ten votes fired at the same moment with exactly one row (R-27)', async () => {
      const userId = await aUser();
      const requestId = await aRequest(userId);

      const attempts = await Promise.allSettled(
        Array.from({ length: 10 }, () => prisma.vote.create({ data: { requestId, userId } })),
      );

      expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
      await expect(prisma.vote.count({ where: { requestId } })).resolves.toBe(1);
    });

    it('lets a different person vote for the same request', async () => {
      const author = await aUser('author@example.com');
      const other = await aUser('other@example.com');
      const requestId = await aRequest(author);

      await prisma.vote.create({ data: { requestId, userId: author } });
      await prisma.vote.create({ data: { requestId, userId: other } });

      await expect(prisma.vote.count({ where: { requestId } })).resolves.toBe(2);
    });
  });

  describe('exactly one status is the first one (R-47)', () => {
    it('refuses a second default status', async () => {
      await aStatus('New', true);

      await expect(aStatus('Triage', true)).rejects.toThrow();
    });

    it('allows many statuses that are not the default', async () => {
      await aStatus('New', true);
      await aStatus('Planned', false);
      await aStatus('Done', false);

      await expect(prisma.status.count()).resolves.toBe(3);
      await expect(prisma.status.count({ where: { isDefault: true } })).resolves.toBe(1);
    });

    it('lets the default move to another status inside one transaction', async () => {
      const oldDefault = await aStatus('New', true);
      const newDefault = await aStatus('Triage', false);

      await prisma.$transaction([
        prisma.status.update({ where: { id: oldDefault }, data: { isDefault: false } }),
        prisma.status.update({ where: { id: newDefault }, data: { isDefault: true } }),
      ]);

      const defaults = await prisma.status.findMany({ where: { isDefault: true } });
      expect(defaults).toHaveLength(1);
      expect(defaults[0]?.id).toBe(newDefault);
    });
  });

  describe('two names can never match, even with different capitals (R-44)', () => {
    it('refuses a category whose name differs only in case', async () => {
      await aCategory('Bug');

      await expect(
        prisma.category.create({ data: { name: 'BUG', slug: 'bug-2', color: '#000000' } }),
      ).rejects.toThrow();
    });

    it('refuses a status whose name differs only in case', async () => {
      await aStatus('Planned', false);

      await expect(
        prisma.status.create({ data: { name: 'planned', slug: 'planned-2', color: '#000000' } }),
      ).rejects.toThrow();
    });
  });

  describe('a category or status in use can never be deleted (R-46)', () => {
    it('refuses to delete a category that a request uses', async () => {
      const userId = await aUser();
      const categoryId = await aCategory('Feature');
      await prisma.feedbackRequest.create({
        data: {
          title: 'Title long enough',
          description: 'Description long enough to pass.',
          categoryId,
          statusId: await aStatus(),
          authorId: userId,
        },
      });

      await expect(prisma.category.delete({ where: { id: categoryId } })).rejects.toThrow();
    });

    it('refuses to delete a status that a request uses', async () => {
      const userId = await aUser();
      const statusId = await aStatus('Under Review');
      await prisma.feedbackRequest.create({
        data: {
          title: 'Title long enough',
          description: 'Description long enough to pass.',
          categoryId: await aCategory(),
          statusId,
          authorId: userId,
        },
      });

      await expect(prisma.status.delete({ where: { id: statusId } })).rejects.toThrow();
    });

    it('allows deleting one nothing points at, so retiring is a choice not a workaround', async () => {
      const categoryId = await aCategory('Unused');

      await expect(prisma.category.delete({ where: { id: categoryId } })).resolves.toBeDefined();
    });
  });

  describe('deleting keeps what should stay and drops what should go (R-61, part 12.10)', () => {
    it('refuses to delete a person who wrote a request', async () => {
      const userId = await aUser();
      await aRequest(userId);

      await expect(prisma.user.delete({ where: { id: userId } })).rejects.toThrow();
    });

    it('takes votes and comments with the request', async () => {
      const userId = await aUser();
      const requestId = await aRequest(userId);
      await prisma.vote.create({ data: { requestId, userId } });
      await prisma.comment.create({ data: { requestId, authorId: userId, body: 'A comment.' } });

      await prisma.feedbackRequest.delete({ where: { id: requestId } });

      await expect(prisma.vote.count()).resolves.toBe(0);
      await expect(prisma.comment.count()).resolves.toBe(0);
    });
  });

  describe('app_settings holds exactly one row', () => {
    it('refuses a second row', async () => {
      await prisma.appSettings.create({ data: { id: 1 } });

      await expect(prisma.appSettings.create({ data: { id: 2 } })).rejects.toThrow();
    });

    it('refuses a limit of zero, which would mean nobody can write at all (R-130)', async () => {
      await expect(
        prisma.appSettings.create({ data: { id: 1, submissionLimitCount: 0 } }),
      ).rejects.toThrow();
    });

    it('refuses an allowed domain that is not in small letters (R-67)', async () => {
      await expect(
        prisma.appSettings.create({ data: { id: 1, allowedEmailDomains: ['Example.com'] } }),
      ).rejects.toThrow();
    });
  });

  describe('the size limits of R-12 and R-32', () => {
    it('refuses a title shorter than five letters', async () => {
      const userId = await aUser();

      await expect(
        prisma.feedbackRequest.create({
          data: {
            title: 'Four',
            description: 'A description long enough to pass.',
            categoryId: await aCategory(),
            statusId: await aStatus(),
            authorId: userId,
          },
        }),
      ).rejects.toThrow();
    });

    it('refuses a description shorter than ten letters', async () => {
      const userId = await aUser();

      await expect(
        prisma.feedbackRequest.create({
          data: {
            title: 'A good title',
            description: 'Too short',
            categoryId: await aCategory(),
            statusId: await aStatus(),
            authorId: userId,
          },
        }),
      ).rejects.toThrow();
    });

    it('refuses an empty comment while it is readable', async () => {
      const userId = await aUser();
      const requestId = await aRequest(userId);

      await expect(
        prisma.comment.create({ data: { requestId, authorId: userId, body: '   ' } }),
      ).rejects.toThrow();
    });

    it('requires a deleted comment to be empty, so the text is really gone (R-38)', async () => {
      const userId = await aUser();
      const requestId = await aRequest(userId);
      const comment = await prisma.comment.create({
        data: { requestId, authorId: userId, body: 'Something rude.' },
      });

      await expect(
        prisma.comment.update({
          where: { id: comment.id },
          data: { state: 'deleted', deletedAt: new Date() },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.comment.update({
          where: { id: comment.id },
          data: { state: 'deleted', body: '', deletedAt: new Date() },
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('a pinned request records when it was pinned (R-23)', () => {
    it('refuses a pin with no time, which would leave the order undefined', async () => {
      const userId = await aUser();
      const requestId = await aRequest(userId);

      await expect(
        prisma.feedbackRequest.update({ where: { id: requestId }, data: { isPinned: true } }),
      ).rejects.toThrow();
    });

    it('refuses an unpinned request that still carries a stale pin time', async () => {
      const userId = await aUser();
      const requestId = await aRequest(userId);

      await expect(
        prisma.feedbackRequest.update({
          where: { id: requestId },
          data: { isPinned: false, pinnedAt: new Date() },
        }),
      ).rejects.toThrow();
    });
  });
});
