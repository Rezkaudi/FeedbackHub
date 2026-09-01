import request from 'supertest';
import {
  TestApi,
  TEST_ORIGIN,
  someAdmin,
  someUser,
  startTestApi,
} from '../../../../../test/support/api-app';

/**
 * R-66 is the rule this file exists for: **only an admin** adds, sees or removes
 * an invitation, and the server decides that from the saved role — not from the
 * screen the person was shown.
 *
 * So every negative case below asserts the status *and* re-reads the table. A
 * server that answers 403 and writes the row anyway looks identical to a correct
 * one from the outside, which is exactly the failure R-157 asks to be tested.
 */
describe('invitations over HTTP', () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await startTestApi();
  }, 240000);

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(async () => {
    await api.database.truncate();
    await api.prisma.user.createMany({
      data: [
        {
          id: someUser.id,
          externalId: 'ext-person',
          email: someUser.email,
          displayName: someUser.displayName,
        },
        {
          id: someAdmin.id,
          externalId: 'ext-admin',
          email: someAdmin.email,
          displayName: someAdmin.displayName,
          role: 'admin',
        },
      ],
    });
    api.signInAs(someAdmin);
  });

  const get = (path: string) => request(api.app.getHttpServer()).get(path);
  const post = (path: string, body: object) =>
    request(api.app.getHttpServer()).post(path).set('Origin', TEST_ORIGIN).send(body);
  const del = (path: string) =>
    request(api.app.getHttpServer()).delete(path).set('Origin', TEST_ORIGIN);

  const countInvitations = (): Promise<number> => api.prisma.invitation.count();

  describe('an admin manages the list', () => {
    it('invites an address', async () => {
      const response = await post('/v1/invitations', { email: 'newcomer@example.com' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ email: 'newcomer@example.com', acceptedAt: null });
      await expect(countInvitations()).resolves.toBe(1);
    });

    it('refuses to invite an address that already belongs to a member, and writes nothing', async () => {
      const response = await post('/v1/invitations', { email: someUser.email });

      expect(response.status).toBe(409);
      await expect(countInvitations()).resolves.toBe(0);
    });

    /**
     * The address is matched against the one the identity provider confirms, so
     * capitals must not make a second invitation. It is stored lowercase.
     */
    it('stores the address in one shape, so two spellings are one invitation', async () => {
      await post('/v1/invitations', { email: 'Newcomer@Example.COM' }).expect(201);

      const row = await api.prisma.invitation.findFirstOrThrow();
      expect(row.email).toBe('newcomer@example.com');

      const again = await post('/v1/invitations', { email: 'newcomer@example.com' });
      expect(again.status).toBe(409);
      await expect(countInvitations()).resolves.toBe(1);
    });

    /**
     * A padded address never reaches the entity's own trim: the DTO refuses it
     * first. That is the behaviour we want — the admin is told, rather than an
     * address being quietly changed under them — so it is pinned here.
     */
    it('refuses a padded address rather than silently trimming it', async () => {
      const response = await post('/v1/invitations', { email: '  newcomer@example.com  ' });

      expect(response.status).toBe(400);
      await expect(countInvitations()).resolves.toBe(0);
    });

    it('lists what has been sent, and whether it was used', async () => {
      await post('/v1/invitations', { email: 'waiting@example.com' }).expect(201);
      const used = await post('/v1/invitations', { email: 'joined@example.com' });
      await api.prisma.invitation.update({
        where: { id: used.body.id as string },
        data: { acceptedAt: new Date('2026-01-01T00:00:00Z') },
      });

      const response = await get('/v1/invitations');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      const byEmail = new Map<string, { acceptedAt: string | null }>(
        (response.body as { email: string; acceptedAt: string | null }[]).map((row) => [
          row.email,
          row,
        ]),
      );
      expect(byEmail.get('waiting@example.com')?.acceptedAt).toBeNull();
      expect(byEmail.get('joined@example.com')?.acceptedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('withdraws one', async () => {
      const created = await post('/v1/invitations', { email: 'mistake@example.com' });

      await del(`/v1/invitations/${created.body.id as string}`).expect(204);

      await expect(countInvitations()).resolves.toBe(0);
    });

    it('says not found when withdrawing one that is gone, instead of pretending', async () => {
      const response = await del('/v1/invitations/00000000-0000-4000-8000-00000000dead');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    });

    it('refuses an id that is not a uuid before it reaches the database', async () => {
      const response = await del('/v1/invitations/not-an-id');

      expect(response.status).toBe(400);
    });
  });

  describe('the domain rule and invitations (R-67)', () => {
    const setPolicy = (body: object) =>
      request(api.app.getHttpServer())
        .patch('/v1/settings/app')
        .set('Origin', TEST_ORIGIN)
        .send(body);

    // app_settings is the one table truncate() keeps (it is a single seeded
    // row), so put the policy back or the next test inherits "domain restricted".
    afterEach(async () => {
      await setPolicy({ registrationPolicy: 'open', allowedEmailDomains: [] });
    });

    it('refuses to invite an address the domain rule would reject, and writes nothing', async () => {
      await setPolicy({
        registrationPolicy: 'domain_restricted',
        allowedEmailDomains: ['company.com'],
      }).expect(200);

      const response = await post('/v1/invitations', { email: 'outsider@example.com' });

      expect(response.status).toBe(409);
      await expect(countInvitations()).resolves.toBe(0);
    });

    it('allows an invitation for an address on an allowed domain', async () => {
      await setPolicy({
        registrationPolicy: 'domain_restricted',
        allowedEmailDomains: ['company.com'],
      }).expect(200);

      const response = await post('/v1/invitations', { email: 'newcomer@company.com' });

      expect(response.status).toBe(201);
      await expect(countInvitations()).resolves.toBe(1);
    });
  });

  describe('everything an admin is not (R-66)', () => {
    it('refuses the list to a normal person, and to nobody at all', async () => {
      api.signInAs(someUser);
      const asPerson = await get('/v1/invitations');
      expect(asPerson.status).toBe(403);
      expect(asPerson.body).toMatchObject({ error: { code: 'FORBIDDEN' } });

      api.signInAs(null);
      const asNobody = await get('/v1/invitations');
      expect(asNobody.status).toBe(401);
      expect(asNobody.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('refuses a normal person an invitation, and writes nothing', async () => {
      api.signInAs(someUser);

      const response = await post('/v1/invitations', { email: 'friend@example.com' });

      expect(response.status).toBe(403);
      await expect(countInvitations()).resolves.toBe(0);
    });

    it('refuses a normal person a withdrawal, and the row survives', async () => {
      const created = await post('/v1/invitations', { email: 'keep-me@example.com' });
      api.signInAs(someUser);

      const response = await del(`/v1/invitations/${created.body.id as string}`);

      expect(response.status).toBe(403);
      await expect(countInvitations()).resolves.toBe(1);
    });

    it('refuses a write with no Origin header, even from an admin (R-3g)', async () => {
      const response = await request(api.app.getHttpServer())
        .post('/v1/invitations')
        .send({ email: 'no-origin@example.com' });

      expect(response.status).toBe(403);
      await expect(countInvitations()).resolves.toBe(0);
    });
  });

  describe('what the body may contain', () => {
    it('refuses something that is not an email address, and names the field (R-88)', async () => {
      const response = await post('/v1/invitations', { email: 'not-an-address' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: { code: 'VALIDATION_FAILED', fields: { email: expect.any(String) } },
      });
      await expect(countInvitations()).resolves.toBe(0);
    });

    it('refuses an extra field rather than ignoring it (R-95)', async () => {
      const response = await post('/v1/invitations', {
        email: 'sneaky@example.com',
        acceptedAt: '2020-01-01T00:00:00.000Z',
        id: '00000000-0000-4000-8000-0000000000ff',
      });

      expect(response.status).toBe(400);
      await expect(countInvitations()).resolves.toBe(0);
    });
  });
});
