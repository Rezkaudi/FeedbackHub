import request from 'supertest';
import {
  TestApi,
  TEST_ORIGIN,
  someAdmin,
  someUser,
  startTestApi,
} from '../../../../../test/support/api-app';

/**
 * Votes, comments, and the feature switch.
 *
 * The switch tests are hard part H-5: a switch that only hides a button is not a
 * switch. Every one of them sends the request straight to the API with the
 * switch off and insists on a refusal with a message.
 */
describe('votes and comments', () => {
  let api: TestApi;
  let requestId: string;
  const thirdPerson = {
    id: '00000000-0000-4000-8000-000000000003',
    role: 'user' as const,
    email: 'third@example.com',
    displayName: 'Third Person',
  };

  beforeAll(async () => {
    api = await startTestApi();
  }, 240000);

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(async () => {
    await api.database.truncate();
    await api.prisma.appSettings.deleteMany();

    for (const person of [someUser, someAdmin, thirdPerson]) {
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

    const category = await api.prisma.category.create({
      data: { name: 'Bug', slug: 'bug', color: '#c62828' },
    });
    const status = await api.prisma.status.create({
      data: { name: 'New', slug: 'new', color: '#616161', isDefault: true },
    });
    requestId = (
      await api.prisma.feedbackRequest.create({
        data: {
          title: 'A request to comment on',
          description: 'Long enough to be a real description.',
          categoryId: category.id,
          statusId: status.id,
          authorId: someUser.id,
        },
      })
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

  const switchCommentsOff = () =>
    api.prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, featureCommentsEnabled: false },
      update: { featureCommentsEnabled: false },
    });

  const requireApproval = () =>
    api.prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, commentsRequireApproval: true },
      update: { commentsRequireApproval: true },
    });

  describe('voting (R-26 to R-29)', () => {
    it('counts the vote and shows I voted', async () => {
      const response = await post(`/v1/requests/${requestId}/vote`);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ voteCount: 1, viewerHasVoted: true });
    });

    it('lets me vote for my own request, starting from zero (R-29)', async () => {
      const before = await get(`/v1/requests/${requestId}`);
      expect(before.body).toMatchObject({ voteCount: 0 });

      await post(`/v1/requests/${requestId}/vote`).expect(201);

      await expect(api.prisma.vote.count()).resolves.toBe(1);
    });

    it('gives back the state rather than an error when I vote twice (R-27)', async () => {
      await post(`/v1/requests/${requestId}/vote`).expect(201);

      const second = await post(`/v1/requests/${requestId}/vote`);

      expect(second.status).toBe(201);
      expect(second.body).toEqual({ voteCount: 1, viewerHasVoted: true });
      await expect(api.prisma.vote.count()).resolves.toBe(1);
    });

    it('makes exactly one vote from ten clicks in the same moment (R-26, H-7)', async () => {
      const attempts = await Promise.all(
        Array.from({ length: 10 }, () => post(`/v1/requests/${requestId}/vote`)),
      );

      // No confusing error for the person: every call is answered normally.
      expect(attempts.every((response) => response.status === 201)).toBe(true);
      await expect(api.prisma.vote.count()).resolves.toBe(1);
    });

    it('takes the vote back, and un-voting nothing is still fine (R-27)', async () => {
      await post(`/v1/requests/${requestId}/vote`).expect(201);

      const first = await del(`/v1/requests/${requestId}/vote`);
      expect(first.body).toEqual({ voteCount: 0, viewerHasVoted: false });

      const again = await del(`/v1/requests/${requestId}/vote`);
      expect(again.status).toBe(200);
      expect(again.body).toEqual({ voteCount: 0, viewerHasVoted: false });
    });

    it('refuses a visitor with 401', async () => {
      api.signInAs(null);

      await post(`/v1/requests/${requestId}/vote`).expect(401);
      await expect(api.prisma.vote.count()).resolves.toBe(0);
    });

    it('says the request is gone when it was just deleted (SRS 15.4)', async () => {
      await api.prisma.feedbackRequest.delete({ where: { id: requestId } });

      const response = await post(`/v1/requests/${requestId}/vote`);

      expect(response.status).toBe(404);
    });

    it('refuses once the vote limit is reached, and the count does not change', async () => {
      await api.prisma.appSettings.upsert({
        where: { id: 1 },
        create: { id: 1, voteLimitCount: 1, voteLimitMinutes: 60 },
        update: { voteLimitCount: 1, voteLimitMinutes: 60 },
      });
      await post(`/v1/requests/${requestId}/vote`).expect(201);

      const other = await api.prisma.feedbackRequest.create({
        data: {
          title: 'Another request entirely',
          description: 'Also long enough to be real.',
          categoryId: (await api.prisma.category.findFirstOrThrow()).id,
          statusId: (await api.prisma.status.findFirstOrThrow()).id,
          authorId: someUser.id,
        },
      });

      const response = await post(`/v1/requests/${other.id}/vote`);

      expect(response.status).toBe(429);
      expect((response.body as { error: { retryAt: string } }).error.retryAt).toBeDefined();
      await expect(api.prisma.vote.count()).resolves.toBe(1);
    });
  });

  describe('commenting (R-32 to R-39)', () => {
    it('writes one and counts it', async () => {
      const response = await post(`/v1/requests/${requestId}/comments`, { body: 'A comment.' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        body: 'A comment.',
        state: 'published',
        authorName: someUser.displayName,
        isMine: true,
      });
    });

    it('lists newest first (R-33, R-33a)', async () => {
      await post(`/v1/requests/${requestId}/comments`, { body: 'The older one.' }).expect(201);
      await post(`/v1/requests/${requestId}/comments`, { body: 'The newer one.' }).expect(201);

      const response = await get(`/v1/requests/${requestId}/comments`);

      const items = (response.body as { items: { body: string }[] }).items;
      expect(items[0]?.body).toBe('The newer one.');
      expect(response.body).toMatchObject({ total: 2, nextCursor: null });
    });

    it('reads the rest by cursor, showing nothing twice and missing nothing (R-33b)', async () => {
      for (let i = 0; i < 5; i += 1) {
        await post(`/v1/requests/${requestId}/comments`, { body: `Comment ${i}` }).expect(201);
      }

      const first = await get(`/v1/requests/${requestId}/comments?limit=2`);
      const firstIds = (first.body as { items: { id: string }[] }).items.map((c) => c.id);
      const cursor = (first.body as { nextCursor: string }).nextCursor;
      expect(cursor).not.toBeNull();

      // A new comment arrives while the person is reading. With page numbers
      // this would push a comment they already saw into the next page.
      await post(`/v1/requests/${requestId}/comments`, { body: 'Arrived meanwhile' }).expect(201);

      const second = await get(`/v1/requests/${requestId}/comments?limit=2&cursor=${cursor}`);
      const secondIds = (second.body as { items: { id: string }[] }).items.map((c) => c.id);

      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    });

    it('refuses a cursor that is not one of ours', async () => {
      const response = await get(`/v1/requests/${requestId}/comments?cursor=not-a-cursor`);

      expect(response.status).toBe(400);
    });

    it('lets the writer edit their own (R-35)', async () => {
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'First words.' });
      const id = (created.body as { id: string }).id;

      const response = await patch(`/v1/comments/${id}`, { body: 'Better words.' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ body: 'Better words.' });
    });

    it('answers 403 when a normal person edits someone else\'s, and changes nothing (R-36)', async () => {
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'My own words.' });
      const id = (created.body as { id: string }).id;
      api.signInAs(thirdPerson);

      const response = await patch(`/v1/comments/${id}`, { body: 'Rewritten by someone else.' });

      expect(response.status).toBe(403);
      await expect(
        api.prisma.comment.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ body: 'My own words.' });
    });

    it('refuses an ADMIN editing someone else\'s words: moderation is deleting (R-36)', async () => {
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'My own words.' });
      const id = (created.body as { id: string }).id;
      api.signInAs(someAdmin);

      const response = await patch(`/v1/comments/${id}`, { body: 'An admin rewrote this.' });

      expect(response.status).toBe(403);
      await expect(
        api.prisma.comment.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ body: 'My own words.' });
    });

    it('leaves a grey line when deleted, and stops counting it (R-38, R-39)', async () => {
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'Something rude.' });
      const id = (created.body as { id: string }).id;

      await del(`/v1/comments/${id}`).expect(204);

      const row = await api.prisma.comment.findUniqueOrThrow({ where: { id } });
      expect(row.state).toBe('deleted');
      // The text is gone for good.
      expect(row.body).toBe('');

      const list = await get(`/v1/requests/${requestId}/comments`);
      expect(list.body).toMatchObject({ total: 0 });
      // The row stays, so the thread keeps its shape.
      expect((list.body as { items: unknown[] }).items).toHaveLength(1);
    });

    it('lets an admin delete anyone\'s (R-37)', async () => {
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'Something rude.' });
      const id = (created.body as { id: string }).id;
      api.signInAs(someAdmin);

      await del(`/v1/comments/${id}`).expect(204);
    });
  });

  describe('comments that need approval (R-40, R-41, R-125)', () => {
    it('shows a waiting comment only to its writer and to admins', async () => {
      await requireApproval();
      await post(`/v1/requests/${requestId}/comments`, { body: 'Waiting for review.' }).expect(201);

      const mine = await get(`/v1/requests/${requestId}/comments`);
      expect((mine.body as { items: { state: string }[] }).items[0]?.state).toBe('pending');

      api.signInAs(thirdPerson);
      const theirs = await get(`/v1/requests/${requestId}/comments`);
      expect((theirs.body as { items: unknown[] }).items).toHaveLength(0);

      api.signInAs(someAdmin);
      const admin = await get(`/v1/requests/${requestId}/comments`);
      expect((admin.body as { items: unknown[] }).items).toHaveLength(1);
    });

    it('counts a waiting comment differently for different people, and both are right (R-33c)', async () => {
      await requireApproval();
      await post(`/v1/requests/${requestId}/comments`, { body: 'Waiting for review.' }).expect(201);

      const mine = await get(`/v1/requests/${requestId}/comments`);
      expect(mine.body).toMatchObject({ total: 1 });

      api.signInAs(thirdPerson);
      const theirs = await get(`/v1/requests/${requestId}/comments`);
      expect(theirs.body).toMatchObject({ total: 0 });
    });

    it('makes it visible once an admin approves it (R-41)', async () => {
      await requireApproval();
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'Please approve.' });
      const id = (created.body as { id: string }).id;

      api.signInAs(someAdmin);
      await post(`/v1/admin/comments/${id}/approve`).expect(201);

      api.signInAs(thirdPerson);
      const theirs = await get(`/v1/requests/${requestId}/comments`);
      expect(theirs.body).toMatchObject({ total: 1 });
    });

    it('turns a rejected comment into a grey line (R-41)', async () => {
      await requireApproval();
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'Please reject.' });
      const id = (created.body as { id: string }).id;

      api.signInAs(someAdmin);
      await post(`/v1/admin/comments/${id}/reject`).expect(201);

      const row = await api.prisma.comment.findUniqueOrThrow({ where: { id } });
      expect(row.state).toBe('deleted');
      expect(row.body).toBe('');
    });

    it('refuses a normal person approving anything (R-70)', async () => {
      await requireApproval();
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'Waiting.' });
      const id = (created.body as { id: string }).id;

      const response = await post(`/v1/admin/comments/${id}/approve`);

      expect(response.status).toBe(403);
      await expect(
        api.prisma.comment.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ state: 'pending' });
    });
  });

  /**
   * H-5. Each of these sends the request straight to the API, with no screen
   * involved, and insists the server itself says no.
   */
  describe('the comments feature switch (R-42)', () => {
    it('refuses a new comment with a message saying comments are switched off', async () => {
      await switchCommentsOff();

      const response = await post(`/v1/requests/${requestId}/comments`, { body: 'Sneaking in.' });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: { code: 'FEATURE_DISABLED', message: 'Comments are switched off.' },
      });
      await expect(api.prisma.comment.count()).resolves.toBe(0);
    });

    it('refuses reading the thread too', async () => {
      await post(`/v1/requests/${requestId}/comments`, { body: 'Written while on.' }).expect(201);
      await switchCommentsOff();

      const response = await get(`/v1/requests/${requestId}/comments`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ error: { code: 'FEATURE_DISABLED' } });
    });

    it('refuses editing and deleting as well, not only writing', async () => {
      const created = await post(`/v1/requests/${requestId}/comments`, { body: 'Written while on.' });
      const id = (created.body as { id: string }).id;
      await switchCommentsOff();

      await patch(`/v1/comments/${id}`, { body: 'Changed while off.' }).expect(403);
      await del(`/v1/comments/${id}`).expect(403);

      await expect(
        api.prisma.comment.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ body: 'Written while on.', state: 'published' });
    });

    it('takes comment counts off the board (R-42)', async () => {
      await post(`/v1/requests/${requestId}/comments`, { body: 'Written while on.' }).expect(201);

      const before = await get('/v1/requests');
      expect((before.body as { items: { commentCount: number }[] }).items[0]).toMatchObject({
        commentCount: 1,
      });

      await switchCommentsOff();

      const after = await get('/v1/requests');
      expect((after.body as { items: { commentCount: number }[] }).items[0]).toMatchObject({
        commentCount: 0,
      });
    });

    it('refuses an admin too: a limit is not a permission, and neither is a switch', async () => {
      await switchCommentsOff();
      api.signInAs(someAdmin);

      await post(`/v1/requests/${requestId}/comments`, { body: 'Admins are not special.' }).expect(
        403,
      );
    });

    it('works again the moment the switch goes back on, with no restart', async () => {
      await switchCommentsOff();
      await post(`/v1/requests/${requestId}/comments`, { body: 'Refused.' }).expect(403);

      await api.prisma.appSettings.update({
        where: { id: 1 },
        data: { featureCommentsEnabled: true },
      });

      await post(`/v1/requests/${requestId}/comments`, { body: 'Accepted now.' }).expect(201);
    });
  });

  describe('the start-up call (R-52, H-4)', () => {
    it('returns everything the app needs in one call', async () => {
      const response = await get('/v1/bootstrap');

      expect(response.status).toBe(200);
      expect(Object.keys(response.body as object).sort()).toEqual([
        'categories',
        'features',
        'settings',
        'statuses',
        'user',
      ]);
      expect(response.body).toMatchObject({
        user: { displayName: someUser.displayName, role: 'user' },
        settings: { language: 'en', notifyOnComment: true },
        features: { commentsEnabled: true, commentsRequireApproval: false },
      });
      expect((response.body as { categories: unknown[] }).categories).toHaveLength(1);
      expect((response.body as { statuses: unknown[] }).statuses).toHaveLength(1);
    });

    it('carries the switch, so the screen and the server agree (R-42)', async () => {
      await switchCommentsOff();

      const response = await get('/v1/bootstrap');

      expect(response.body).toMatchObject({ features: { commentsEnabled: false } });
    });

    it('never carries a secret or an address (R-53)', async () => {
      const response = await get('/v1/bootstrap');
      const body = JSON.stringify(response.body);

      expect(body).not.toContain('postgres');
      expect(body).not.toContain('secret');
      expect(body).not.toContain('redis');
    });

    it('refuses a visitor with 401', async () => {
      api.signInAs(null);

      await get('/v1/bootstrap').expect(401);
    });
  });
});
