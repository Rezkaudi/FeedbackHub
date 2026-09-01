import request from 'supertest';
import {
  TestApi,
  TEST_ORIGIN,
  someAdmin,
  someUser,
  startTestApi,
} from '../../../../../test/support/api-app';

/**
 * The board and the request lifecycle over HTTP.
 *
 * The ownership cases (R-13, R-14) are the ones R-157 cares about most: every
 * refusal below re-reads the row afterwards to prove nothing changed.
 */
describe('requests and the board', () => {
  let api: TestApi;
  let categoryId: string;
  let otherCategoryId: string;
  let newStatusId: string;
  let plannedStatusId: string;

  beforeAll(async () => {
    api = await startTestApi();
  }, 240000);

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(async () => {
    await api.database.truncate();
    await api.prisma.appSettings.deleteMany();

    for (const person of [someUser, someAdmin]) {
      await api.prisma.user.create({
        data: {
          id: person.id,
          externalId: `ext-${person.id}`,
          email: person.email,
          displayName: person.displayName,
          role: person.role,
        },
      });
    }

    categoryId = (
      await api.prisma.category.create({ data: { name: 'Bug', slug: 'bug', color: '#c62828' } })
    ).id;
    otherCategoryId = (
      await api.prisma.category.create({
        data: { name: 'Feature', slug: 'feature', color: '#1565c0' },
      })
    ).id;
    newStatusId = (
      await api.prisma.status.create({
        data: { name: 'New', slug: 'new', color: '#616161', isDefault: true },
      })
    ).id;
    plannedStatusId = (
      await api.prisma.status.create({ data: { name: 'Planned', slug: 'planned', color: '#00838f' } })
    ).id;

    api.signInAs(someUser);
  });

  const post = (path: string, body?: object) =>
    request(api.app.getHttpServer()).post(path).set('Origin', TEST_ORIGIN).send(body ?? {});
  const patch = (path: string, body: object) =>
    request(api.app.getHttpServer()).patch(path).set('Origin', TEST_ORIGIN).send(body);
  const del = (path: string) =>
    request(api.app.getHttpServer()).delete(path).set('Origin', TEST_ORIGIN);
  const get = (path: string) => request(api.app.getHttpServer()).get(path);

  const aRequest = async (
    overrides: { title?: string; description?: string; categoryId?: string } = {},
  ): Promise<string> => {
    const response = await post('/v1/requests', {
      title: overrides.title ?? 'A perfectly good title',
      description: overrides.description ?? 'A description that is long enough to be accepted.',
      categoryId: overrides.categoryId ?? categoryId,
    });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  };

  describe('writing one (R-10 to R-12)', () => {
    it('gives it the first status, my name and zero votes', async () => {
      const response = await post('/v1/requests', {
        title: 'A perfectly good title',
        description: 'A description that is long enough to be accepted.',
        categoryId,
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        statusId: newStatusId,
        authorName: someUser.displayName,
        voteCount: 0,
        commentCount: 0,
        isPinned: false,
        viewerHasVoted: false,
      });
    });

    it('refuses a status or a vote count sent by the browser (SRS part 17)', async () => {
      const response = await post('/v1/requests', {
        title: 'A perfectly good title',
        description: 'A description that is long enough to be accepted.',
        categoryId,
        statusId: plannedStatusId,
        voteCount: 99,
      });

      expect(response.status).toBe(400);
      await expect(api.prisma.feedbackRequest.count()).resolves.toBe(0);
    });

    it('refuses a four letter title, naming the field (R-12, R-88)', async () => {
      const response = await post('/v1/requests', {
        title: 'Four',
        description: 'A description that is long enough to be accepted.',
        categoryId,
      });

      expect(response.status).toBe(400);
      expect((response.body as { error: { fields: object } }).error.fields).toHaveProperty('title');
      await expect(api.prisma.feedbackRequest.count()).resolves.toBe(0);
    });

    it('refuses a retired category, so the form can ask for another (SRS 15.3)', async () => {
      await api.prisma.category.update({
        where: { id: otherCategoryId },
        data: { isActive: false },
      });

      const response = await post('/v1/requests', {
        title: 'A perfectly good title',
        description: 'A description that is long enough to be accepted.',
        categoryId: otherCategoryId,
      });

      expect(response.status).toBe(400);
      await expect(api.prisma.feedbackRequest.count()).resolves.toBe(0);
    });
  });

  describe('who may change it (R-13, R-14)', () => {
    it('lets me edit my own', async () => {
      const id = await aRequest();

      const response = await patch(`/v1/requests/${id}`, { title: 'A better title entirely' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ title: 'A better title entirely' });
    });

    it('answers 403 when a normal person edits someone else\'s, and changes nothing', async () => {
      const id = await aRequest();
      api.signInAs({ ...someUser, id: someAdmin.id, role: 'user', displayName: 'Someone Else' });

      const response = await patch(`/v1/requests/${id}`, { title: 'Hijacked title here' });

      expect(response.status).toBe(403);
      await expect(
        api.prisma.feedbackRequest.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ title: 'A perfectly good title' });
    });

    it('answers 403 when a normal person deletes someone else\'s, and deletes nothing', async () => {
      const id = await aRequest();
      api.signInAs({ ...someUser, id: someAdmin.id, role: 'user' });

      const response = await del(`/v1/requests/${id}`);

      expect(response.status).toBe(403);
      await expect(api.prisma.feedbackRequest.count()).resolves.toBe(1);
    });

    it('lets an admin change anyone\'s', async () => {
      const id = await aRequest();
      api.signInAs(someAdmin);

      await patch(`/v1/requests/${id}`, { title: 'An admin fixed this title' }).expect(200);
    });

    it('takes the votes and comments with it when deleted (R-14)', async () => {
      const id = await aRequest();
      await post(`/v1/requests/${id}/vote`).expect(201);
      await post(`/v1/requests/${id}/comments`, { body: 'A comment.' }).expect(201);

      await del(`/v1/requests/${id}`).expect(204);

      await expect(api.prisma.vote.count()).resolves.toBe(0);
      await expect(api.prisma.comment.count()).resolves.toBe(0);
    });
  });

  describe('the status and the pin are admin only (R-64, R-65)', () => {
    it('refuses a normal person changing a status, and changes nothing', async () => {
      const id = await aRequest();

      const response = await patch(`/v1/requests/${id}/status`, { statusId: plannedStatusId });

      expect(response.status).toBe(403);
      await expect(
        api.prisma.feedbackRequest.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ statusId: newStatusId });
    });

    it('refuses a normal person pinning, even on their own request', async () => {
      const id = await aRequest();

      const response = await patch(`/v1/requests/${id}/pin`, { pinned: true });

      expect(response.status).toBe(403);
      await expect(
        api.prisma.feedbackRequest.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ isPinned: false });
    });

    it('lets an admin change the status, and it shows at once', async () => {
      const id = await aRequest();
      api.signInAs(someAdmin);

      const response = await patch(`/v1/requests/${id}/status`, { statusId: plannedStatusId });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ statusId: plannedStatusId });
    });
  });

  describe('the board (R-16 to R-25)', () => {
    it('searches words in the description, not only the title (R-17)', async () => {
      await aRequest({ title: 'First request here', description: 'Contains the word pineapple.' });
      await aRequest({ title: 'Second request here', description: 'Contains nothing unusual.' });

      const response = await get('/v1/requests?search=pineapple');

      expect(response.body).toMatchObject({ total: 1 });
      expect((response.body as { items: { title: string }[] }).items[0]?.title).toBe(
        'First request here',
      );
    });

    it('does not search comments (R-17)', async () => {
      const id = await aRequest({ description: 'Nothing unusual in here at all.' });
      await post(`/v1/requests/${id}/comments`, { body: 'pineapple' }).expect(201);

      const response = await get('/v1/requests?search=pineapple');

      expect(response.body).toMatchObject({ total: 0 });
    });

    it('treats a percent sign as text, not a wildcard', async () => {
      await aRequest({ title: 'Loading stops at 50% forever', description: 'It never finishes.' });
      await aRequest({ title: 'Another separate request', description: 'Nothing to do with it.' });

      const response = await get('/v1/requests?search=50%25');

      expect(response.body).toMatchObject({ total: 1 });
    });

    it('means OR inside a filter and AND between them (R-18)', async () => {
      const first = await aRequest({ categoryId });
      await aRequest({ categoryId: otherCategoryId });
      api.signInAs(someAdmin);
      await patch(`/v1/requests/${first}/status`, { statusId: plannedStatusId }).expect(200);
      api.signInAs(someUser);

      const both = await get(
        `/v1/requests?statusIds=${newStatusId}&statusIds=${plannedStatusId}`,
      );
      expect(both.body).toMatchObject({ total: 2 });

      const narrowed = await get(
        `/v1/requests?statusIds=${plannedStatusId}&categoryIds=${categoryId}`,
      );
      expect(narrowed.body).toMatchObject({ total: 1 });

      const contradictory = await get(
        `/v1/requests?statusIds=${plannedStatusId}&categoryIds=${otherCategoryId}`,
      );
      expect(contradictory.body).toMatchObject({ total: 0 });
    });

    it('shows only my own requests when mine=true, and everything without it', async () => {
      await aRequest({ title: 'Mine to keep' });
      api.signInAs(someAdmin);
      await aRequest({ title: 'Belongs to the admin' });
      api.signInAs(someUser);

      const all = await get('/v1/requests');
      expect(all.body).toMatchObject({ total: 2 });

      const onlyMine = await get('/v1/requests?mine=true');
      expect(onlyMine.body).toMatchObject({ total: 1 });
      expect((onlyMine.body as { items: { title: string }[] }).items[0]?.title).toBe('Mine to keep');
    });

    it('refuses a made-up sort name (R-20)', async () => {
      const response = await get('/v1/requests?sort=; DROP TABLE users');

      expect(response.status).toBe(400);
      // The table is still there.
      await expect(api.prisma.user.count()).resolves.toBe(2);
    });

    it.each(['newest', 'oldest', 'most_votes', 'most_comments'])('accepts %s', async (sort) => {
      await get(`/v1/requests?sort=${sort}`).expect(200);
    });

    it('puts pinned requests first (R-23)', async () => {
      await aRequest({ title: 'An ordinary request' });
      const pinned = await aRequest({ title: 'The pinned one here' });
      api.signInAs(someAdmin);
      await patch(`/v1/requests/${pinned}/pin`, { pinned: true }).expect(200);
      api.signInAs(someUser);

      const response = await get('/v1/requests?sort=oldest');

      expect((response.body as { items: { id: string }[] }).items[0]?.id).toBe(pinned);
    });

    it('never lets a pin escape the filter (R-23)', async () => {
      const pinned = await aRequest({ categoryId });
      api.signInAs(someAdmin);
      await patch(`/v1/requests/${pinned}/pin`, { pinned: true }).expect(200);
      api.signInAs(someUser);

      const response = await get(`/v1/requests?categoryIds=${otherCategoryId}`);

      expect(response.body).toMatchObject({ total: 0 });
    });

    it('pages, and says how many there are in total (R-21)', async () => {
      for (let i = 0; i < 5; i += 1) {
        await aRequest({ title: `Request number ${i} here` });
      }

      const response = await get('/v1/requests?page=2&pageSize=2');

      expect(response.body).toMatchObject({ total: 5, page: 2, pageSize: 2 });
      expect((response.body as { items: unknown[] }).items).toHaveLength(2);
    });

    it('goes back to the last real page when asked past the end (SRS 15.1)', async () => {
      await aRequest();
      await aRequest({ title: 'A second request here' });

      const response = await get('/v1/requests?page=5&pageSize=2');

      expect(response.body).toMatchObject({ page: 1, total: 2 });
      expect((response.body as { items: unknown[] }).items).toHaveLength(2);
    });

    it('counts votes from the real rows (R-28)', async () => {
      const id = await aRequest();
      await post(`/v1/requests/${id}/vote`).expect(201);

      const response = await get('/v1/requests');

      expect((response.body as { items: { voteCount: number }[] }).items[0]).toMatchObject({
        voteCount: 1,
        viewerHasVoted: true,
      });
    });

    it('never sends the author\'s email (R-99)', async () => {
      await aRequest();

      const response = await get('/v1/requests');
      const item = (response.body as { items: object[] }).items[0] ?? {};

      expect(JSON.stringify(item)).not.toContain(someUser.email);
      expect(Object.keys(item)).not.toContain('authorId');
    });
  });
});
