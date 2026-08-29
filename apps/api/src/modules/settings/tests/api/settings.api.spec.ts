import request from 'supertest';
import {
  TestApi,
  TEST_ORIGIN,
  someAdmin,
  someUser,
  startTestApi,
} from '../../../../../test/support/api-app';

/**
 * R-60 is the rule this file exists for: a person can only change a fixed list
 * of their own settings, and trying to change an admin setting, a theme or a
 * sort through the API is **refused with a message, not quietly ignored**.
 *
 * "Not quietly ignored" is the part that needs a test. A server that drops the
 * field and answers 200 looks identical to one that saved it, until someone
 * checks — so every case below asserts the status *and* re-reads the row.
 */
describe('settings over HTTP', () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await startTestApi();
  }, 240000);

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(async () => {
    await api.database.truncate();
    await api.prisma.appSettings.deleteMany();
    await api.prisma.user.create({
      data: {
        id: someUser.id,
        externalId: 'ext-person',
        email: someUser.email,
        displayName: someUser.displayName,
      },
    });
    api.signInAs(someUser);
  });

  const patch = (path: string, body: object) =>
    request(api.app.getHttpServer()).patch(path).set('Origin', TEST_ORIGIN).send(body);
  const get = (path: string) => request(api.app.getHttpServer()).get(path);

  describe('my own settings (R-60)', () => {
    it('starts from the code defaults when I have changed nothing (R-51)', async () => {
      const response = await get('/v1/settings/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        language: 'en',
        notifyOnComment: true,
        notifyOnStatusChange: true,
      });
    });

    it('lets me change my language and my email choices', async () => {
      const response = await patch('/v1/settings/me', {
        language: 'ar',
        notifyOnComment: false,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ language: 'ar', notifyOnComment: false });
      await expect(
        api.prisma.userSettings.findUniqueOrThrow({ where: { userId: someUser.id } }),
      ).resolves.toMatchObject({ language: 'ar', notifyOnComment: false });
    });

    it.each([
      ['theme', { theme: 'dark' }],
      ['defaultSort', { defaultSort: 'most_votes' }],
      ['defaultFilters', { defaultFilters: ['bug'] }],
    ])('refuses %s with a message rather than ignoring it (R-60)', async (_name, body) => {
      const response = await patch('/v1/settings/me', body);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
      await expect(api.prisma.userSettings.count()).resolves.toBe(0);
    });

    it('refuses an admin setting sent to the user endpoint, and saves nothing', async () => {
      const response = await patch('/v1/settings/me', { featureCommentsEnabled: false });

      expect(response.status).toBe(400);
      await expect(api.prisma.appSettings.count()).resolves.toBe(0);
      await expect(api.prisma.userSettings.count()).resolves.toBe(0);
    });

    it('refuses a userId in the body: whose settings these are comes from the session (R-7)', async () => {
      const response = await patch('/v1/settings/me', {
        userId: someAdmin.id,
        notifyOnComment: false,
      });

      expect(response.status).toBe(400);
      await expect(api.prisma.userSettings.count()).resolves.toBe(0);
    });

    it('refuses a language that is not one we have', async () => {
      const response = await patch('/v1/settings/me', { language: 'fr' });

      expect(response.status).toBe(400);
    });

    it('lets me clear my language and fall back to the code default (R-51)', async () => {
      await patch('/v1/settings/me', { language: 'ar' }).expect(200);

      const response = await patch('/v1/settings/me', { language: null });

      expect(response.body).toMatchObject({ language: 'en' });
      await expect(
        api.prisma.userSettings.findUniqueOrThrow({ where: { userId: someUser.id } }),
      ).resolves.toMatchObject({ language: null });
    });
  });

  describe('application settings (R-69, R-70)', () => {
    it('refuses a normal person reading them, and refuses them changing them', async () => {
      await get('/v1/settings/app').expect(403);

      const response = await patch('/v1/settings/app', { featureCommentsEnabled: false });

      expect(response.status).toBe(403);
      await expect(api.prisma.appSettings.count()).resolves.toBe(0);
    });

    it('refuses a visitor with 401, not 403 (R-6)', async () => {
      api.signInAs(null);

      await get('/v1/settings/app').expect(401);
    });

    it('gives an admin the code defaults before any row exists (R-42)', async () => {
      api.signInAs(someAdmin);

      const response = await get('/v1/settings/app');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        registrationPolicy: 'open',
        featureCommentsEnabled: true,
        submissionLimitCount: 10,
        voteLimitCount: 100,
      });
    });

    it('saves a change and reads it back at once, with no restart (R-69)', async () => {
      api.signInAs(someAdmin);

      await patch('/v1/settings/app', {
        featureCommentsEnabled: false,
        submissionLimitCount: 3,
      }).expect(200);

      const response = await get('/v1/settings/app');
      expect(response.body).toMatchObject({
        featureCommentsEnabled: false,
        submissionLimitCount: 3,
      });
    });

    it('refuses a limit of zero and leaves every setting as it was (R-130, SRS 15.7)', async () => {
      api.signInAs(someAdmin);
      await patch('/v1/settings/app', { submissionLimitCount: 7 }).expect(200);

      const response = await patch('/v1/settings/app', {
        featureCommentsEnabled: false,
        voteLimitCount: 0,
      });

      expect(response.status).toBe(400);
      const after = await get('/v1/settings/app');
      expect(after.body).toMatchObject({
        featureCommentsEnabled: true,
        submissionLimitCount: 7,
        voteLimitCount: 100,
      });
    });

    it('refuses the domain rule with no domains (R-67)', async () => {
      api.signInAs(someAdmin);

      const response = await patch('/v1/settings/app', {
        registrationPolicy: 'domain_restricted',
        allowedEmailDomains: [],
      });

      expect(response.status).toBe(400);
    });

    it('stores allowed domains in small letters, so a capital cannot dodge the rule', async () => {
      api.signInAs(someAdmin);

      const response = await patch('/v1/settings/app', {
        registrationPolicy: 'domain_restricted',
        allowedEmailDomains: ['Example.COM'],
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ allowedEmailDomains: ['example.com'] });
    });

    it('keeps exactly one settings row however many times it is saved', async () => {
      api.signInAs(someAdmin);

      await patch('/v1/settings/app', { voteLimitCount: 5 }).expect(200);
      await patch('/v1/settings/app', { voteLimitCount: 6 }).expect(200);

      await expect(api.prisma.appSettings.count()).resolves.toBe(1);
    });
  });
});
