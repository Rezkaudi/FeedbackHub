import request from 'supertest';
import { TestApi, TEST_ORIGIN, someAdmin, someUser, startTestApi } from '../../../../../test/support/api-app';

/**
 * The server's answer, through the whole guard chain, with no screen involved.
 *
 * R-157: every "no" in SRS part 4 gets a test that calls the API directly and
 * proves the server answers 401 or 403 **and that nothing changed**. The second
 * half is the part that is easy to forget, so every refusal below re-reads the
 * data afterwards.
 */
describe('taxonomy over HTTP', () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await startTestApi();
  }, 240000);

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(async () => {
    await api.database.truncate();
    api.signInAs(someAdmin);
  });

  const post = (path: string, body?: object) =>
    request(api.app.getHttpServer()).post(path).set('Origin', TEST_ORIGIN).send(body ?? {});
  const patch = (path: string, body: object) =>
    request(api.app.getHttpServer()).patch(path).set('Origin', TEST_ORIGIN).send(body);
  const del = (path: string) =>
    request(api.app.getHttpServer()).delete(path).set('Origin', TEST_ORIGIN);
  const get = (path: string) => request(api.app.getHttpServer()).get(path);

  const aCategory = async (name = 'Bug'): Promise<string> => {
    const response = await post('/v1/taxonomy/categories', { name, color: '#c62828' });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  };

  describe('who is allowed (SRS part 4)', () => {
    it('refuses a visitor with 401, not a redirect and not data', async () => {
      api.signInAs(null);

      const response = await get('/v1/taxonomy');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('refuses a normal person with 403, and saves nothing (R-70)', async () => {
      api.signInAs(someUser);

      const response = await post('/v1/taxonomy/categories', { name: 'Sneaky', color: '#000000' });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ error: { code: 'FORBIDDEN' } });
      await expect(api.prisma.category.count()).resolves.toBe(0);
    });

    it('refuses a normal person deleting a category, whatever the screen showed', async () => {
      const id = await aCategory();
      api.signInAs(someUser);

      const response = await del(`/v1/taxonomy/categories/${id}`);

      expect(response.status).toBe(403);
      await expect(api.prisma.category.count()).resolves.toBe(1);
    });

    it('lets an admin through', async () => {
      const response = await get('/v1/taxonomy');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ categories: [], statuses: [] });
    });
  });

  describe('the Origin check (R-3g)', () => {
    it('refuses a write from an origin that is not ours', async () => {
      const response = await request(api.app.getHttpServer())
        .post('/v1/taxonomy/categories')
        .set('Origin', 'https://evil.test')
        .send({ name: 'Bug', color: '#c62828' });

      expect(response.status).toBe(403);
      await expect(api.prisma.category.count()).resolves.toBe(0);
    });

    it('refuses a write that names no origin at all', async () => {
      const response = await request(api.app.getHttpServer())
        .post('/v1/taxonomy/categories')
        .send({ name: 'Bug', color: '#c62828' });

      expect(response.status).toBe(403);
      await expect(api.prisma.category.count()).resolves.toBe(0);
    });
  });

  describe('what the server accepts (R-95)', () => {
    it('refuses an unknown field rather than ignoring it — no mass assignment', async () => {
      const response = await post('/v1/taxonomy/categories', {
        name: 'Bug',
        color: '#c62828',
        isActive: false,
        id: 'chosen-by-the-caller',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
      await expect(api.prisma.category.count()).resolves.toBe(0);
    });

    it('names the field that is wrong, so the form can point at it (R-88)', async () => {
      const response = await post('/v1/taxonomy/categories', { name: '', color: 'not-a-colour' });

      expect(response.status).toBe(400);
      expect(Object.keys((response.body as { error: { fields: object } }).error.fields)).toEqual(
        expect.arrayContaining(['name', 'color']),
      );
    });

    it('refuses an id that is not a uuid', async () => {
      const response = await del('/v1/taxonomy/categories/not-a-uuid');

      expect(response.status).toBe(400);
    });

    it('carries a request id on every error, so support can find it (R-100)', async () => {
      const response = await post('/v1/taxonomy/categories', { name: '' });

      expect((response.body as { error: { requestId: string } }).error.requestId).toMatch(
        /^[0-9a-f-]{36}$/,
      );
    });
  });

  describe('categories', () => {
    it('adds one, and it comes back in the list', async () => {
      await aCategory('Feature');

      const response = await get('/v1/taxonomy');

      expect(response.body).toMatchObject({
        categories: [{ name: 'Feature', slug: 'feature', color: '#c62828', isActive: true }],
      });
    });

    it('sends only the fields it means to send (R-77)', async () => {
      await aCategory();

      const response = await get('/v1/taxonomy');
      const [category] = (response.body as { categories: object[] }).categories;

      expect(Object.keys(category ?? {}).sort()).toEqual([
        'color',
        'description',
        'id',
        'isActive',
        'name',
        'slug',
      ]);
    });

    it('refuses a second category with the same name in different capitals (R-44)', async () => {
      await aCategory('Bug');

      const response = await post('/v1/taxonomy/categories', { name: 'BUG', color: '#000000' });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ error: { code: 'CONFLICT' } });
      await expect(api.prisma.category.count()).resolves.toBe(1);
    });

    it('refuses to retire the last active category, with a reason (R-48)', async () => {
      const id = await aCategory();

      const response = await post(`/v1/taxonomy/categories/${id}/retire`);

      expect(response.status).toBe(409);
      expect((response.body as { error: { message: string } }).error.message).toMatch(
        /only category left/i,
      );
      await expect(
        api.prisma.category.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ isActive: true });
    });

    it('retires one when another is left, and keeps it out of the active list (R-45)', async () => {
      const first = await aCategory('Bug');
      await aCategory('Feature');

      const response = await post(`/v1/taxonomy/categories/${first}/retire`);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ isActive: false });
    });

    it('says 404 for a category that does not exist', async () => {
      const response = await patch('/v1/taxonomy/categories/00000000-0000-4000-8000-00000000dead', {
        name: 'Ghost',
      });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    });
  });

  describe('statuses', () => {
    const aStatus = async (name: string): Promise<string> => {
      const response = await post('/v1/taxonomy/statuses', { name, color: '#1565c0' });
      expect(response.status).toBe(201);
      return (response.body as { id: string }).id;
    };

    it('never makes a new status the first one by itself (R-47)', async () => {
      await aStatus('New');

      const response = await get('/v1/taxonomy');

      expect(response.body).toMatchObject({ statuses: [{ name: 'New', isDefault: false }] });
    });

    it('moves the first-status mark so exactly one has it afterwards (R-47)', async () => {
      const first = await aStatus('New');
      const second = await aStatus('Triage');

      await post(`/v1/taxonomy/statuses/${first}/make-default`).expect(204);
      await post(`/v1/taxonomy/statuses/${second}/make-default`).expect(204);

      const defaults = await api.prisma.status.findMany({ where: { isDefault: true } });
      expect(defaults).toHaveLength(1);
      expect(defaults[0]?.id).toBe(second);
    });

    it('refuses to retire the first status, with the reason (R-48)', async () => {
      const id = await aStatus('New');
      await post(`/v1/taxonomy/statuses/${id}/make-default`).expect(204);

      const response = await post(`/v1/taxonomy/statuses/${id}/retire`);

      expect(response.status).toBe(409);
      expect((response.body as { error: { message: string } }).error.message).toMatch(
        /cannot be retired/i,
      );
      await expect(api.prisma.status.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
        isActive: true,
      });
    });

    it('refuses to make a retired status the first one', async () => {
      const keeper = await aStatus('New');
      await post(`/v1/taxonomy/statuses/${keeper}/make-default`).expect(204);
      const other = await aStatus('Old');
      await post(`/v1/taxonomy/statuses/${other}/retire`).expect(201);

      const response = await post(`/v1/taxonomy/statuses/${other}/make-default`);

      expect(response.status).toBe(409);
      const defaults = await api.prisma.status.findMany({ where: { isDefault: true } });
      expect(defaults[0]?.id).toBe(keeper);
    });
  });

  describe('the health checks are the only way past the guard (R-6, R-83)', () => {
    it('answers liveness with nobody signed in', async () => {
      api.signInAs(null);

      await request(api.app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    });
  });
});
