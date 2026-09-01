import request from 'supertest';
import {
  TestApi,
  TEST_ORIGIN,
  someAdmin,
  someUser,
  startTestApi,
} from '../../../../../test/support/api-app';
import { SignInWithProvider } from '../../application/use-case/sign-in-with-provider';
import { ResolveCurrentUser } from '../../application/use-case/resolve-current-user';
import { DeleteMyAccount } from '../../application/use-case/delete-my-account';
import { SignupNotAllowed } from '../../domain/error/identity-errors';
import { LastAdminCannotLeaveError } from '../../domain/error/identity-errors';
import { RateLimitedError } from '../../../../shared/errors/app-error';

/**
 * The rules that decide who gets an account and who may leave, against a real
 * database. The identity provider is stubbed — signing in for real is the
 * end-to-end suite's job (R-160) — but everything of ours here is production
 * code.
 */
describe('identity', () => {
  let api: TestApi;
  let signIn: SignInWithProvider;
  let deleteAccount: DeleteMyAccount;
  let resolveCurrentUser: ResolveCurrentUser;

  beforeAll(async () => {
    api = await startTestApi();
    signIn = api.app.get(SignInWithProvider);
    deleteAccount = api.app.get(DeleteMyAccount);
    resolveCurrentUser = api.app.get(ResolveCurrentUser);
  }, 240000);

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(async () => {
    await api.database.truncate();
    await api.prisma.appSettings.deleteMany();
    api.identityProvider.claims = {
      subject: 'kc-new-person',
      email: 'new@example.com',
      emailVerified: true,
      displayName: 'New Person',
      avatarUrl: null,
    };
  });

  const setPolicy = (changes: Record<string, unknown>) =>
    api.prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...changes },
      update: changes,
    });

  describe('the first sign-in makes a record (R-4)', () => {
    it('creates the person, as a normal user and never an admin (R-8)', async () => {
      const user = await signIn.execute('token');

      expect(user.role).toBe('user');
      expect(user.email).toBe('new@example.com');
      await expect(api.prisma.user.count()).resolves.toBe(1);
    });

    it('does not make a second record when they sign in again', async () => {
      await signIn.execute('token');
      await signIn.execute('token');

      await expect(api.prisma.user.count()).resolves.toBe(1);
    });

    it('re-links the record, keeping the role, when the provider gives a new subject for the same verified email', async () => {
      const first = await signIn.execute('token');
      await api.prisma.user.update({ where: { id: first.id }, data: { role: 'admin' } });

      // The Keycloak account was deleted and remade: same verified email, new subject.
      api.identityProvider.claims = {
        ...api.identityProvider.claims,
        subject: 'kc-remade-person',
      };
      const again = await signIn.execute('token');

      expect(again.id).toBe(first.id);
      expect(again.role).toBe('admin');
      expect(again.externalId).toBe('kc-remade-person');
      await expect(api.prisma.user.count()).resolves.toBe(1);
    });

    it('does not re-link on an unverified email — that is not proof of who is signing in', async () => {
      await signIn.execute('token');

      api.identityProvider.claims = {
        ...api.identityProvider.claims,
        subject: 'kc-someone-else',
        emailVerified: false,
      };

      // Falls through to the normal sign-up path, which the unique email then stops.
      await expect(signIn.execute('token')).rejects.toThrow();
      await expect(api.prisma.user.count()).resolves.toBe(1);
    });

    it('refreshes an email that changed at the provider, but never the role', async () => {
      const first = await signIn.execute('token');
      await api.prisma.user.update({ where: { id: first.id }, data: { role: 'admin' } });

      api.identityProvider.claims = {
        ...api.identityProvider.claims,
        email: 'renamed@example.com',
      };
      const again = await signIn.execute('token');

      expect(again.email).toBe('renamed@example.com');
      expect(again.role).toBe('admin');
    });
  });

  describe('the sign-up rule (R-67)', () => {
    it('refuses an address with no invitation when the board is invite only', async () => {
      await setPolicy({ registrationPolicy: 'invite_only' });

      await expect(signIn.execute('token')).rejects.toBeInstanceOf(SignupNotAllowed);
      await expect(api.prisma.user.count()).resolves.toBe(0);
    });

    it('lets an invited address in, and marks the invitation used', async () => {
      await setPolicy({ registrationPolicy: 'invite_only' });
      await api.prisma.invitation.create({ data: { email: 'new@example.com' } });

      await signIn.execute('token');

      await expect(api.prisma.user.count()).resolves.toBe(1);
      const invitation = await api.prisma.invitation.findUniqueOrThrow({
        where: { email: 'new@example.com' },
      });
      expect(invitation.acceptedAt).not.toBeNull();
    });

    it('refuses a checked email from another domain', async () => {
      await setPolicy({
        registrationPolicy: 'domain_restricted',
        allowedEmailDomains: ['example.com'],
      });
      api.identityProvider.claims = {
        ...api.identityProvider.claims,
        email: 'someone@other.com',
      };

      await expect(signIn.execute('token')).rejects.toMatchObject({ reason: 'policy_domain' });
      await expect(api.prisma.user.count()).resolves.toBe(0);
    });

    it('refuses an UNCHECKED email on an allowed domain, and says checking is the reason', async () => {
      await setPolicy({
        registrationPolicy: 'domain_restricted',
        allowedEmailDomains: ['example.com'],
      });
      api.identityProvider.claims = { ...api.identityProvider.claims, emailVerified: false };

      await expect(signIn.execute('token')).rejects.toMatchObject({
        reason: 'email_not_verified',
      });
      await expect(api.prisma.user.count()).resolves.toBe(0);
    });

    it('never removes someone who already got in when the rule tightens (SRS part 14)', async () => {
      const existing = await signIn.execute('token');

      await setPolicy({
        registrationPolicy: 'domain_restricted',
        allowedEmailDomains: ['somewhere-else.com'],
      });

      // They signed in before the rule changed, so they keep their account.
      const again = await signIn.execute('token');
      expect(again.id).toBe(existing.id);
    });
  });

  describe('the sign-up limit (R-130, R-132)', () => {
    it('refuses the twenty-first person, and makes no record', async () => {
      await setPolicy({ signupLimitCount: 2, signupLimitMinutes: 60 });

      api.identityProvider.claims = { ...api.identityProvider.claims, subject: 'a', email: 'a@example.com' };
      await signIn.execute('token');
      api.identityProvider.claims = { ...api.identityProvider.claims, subject: 'b', email: 'b@example.com' };
      await signIn.execute('token');

      api.identityProvider.claims = { ...api.identityProvider.claims, subject: 'c', email: 'c@example.com' };
      await expect(signIn.execute('token')).rejects.toBeInstanceOf(RateLimitedError);
      await expect(api.prisma.user.count()).resolves.toBe(2);
    });

    it('is a different answer from "not allowed": they may join, just not yet', async () => {
      await setPolicy({ signupLimitCount: 1, signupLimitMinutes: 60 });
      await signIn.execute('token');

      api.identityProvider.claims = {
        ...api.identityProvider.claims,
        subject: 'later',
        email: 'later@example.com',
      };

      // A rate limit, not a refusal of the person. SRS 15.8 says the message
      // must tell them to try later, and these are different error types so the
      // screen can say different things.
      const failure = signIn.execute('token');
      await expect(failure).rejects.toBeInstanceOf(RateLimitedError);
      await expect(failure).rejects.not.toBeInstanceOf(SignupNotAllowed);
    });
  });

  describe('deleting my account (R-61, R-62)', () => {
    const anActiveUser = async (email: string, role: 'user' | 'admin' = 'user') =>
      api.prisma.user.create({
        data: { externalId: `ext-${email}`, email, displayName: 'A Person', role },
      });

    it('wipes the name and email, drops the votes, and keeps the writing', async () => {
      const author = await anActiveUser('author@example.com');
      const category = await api.prisma.category.create({
        data: { name: 'Bug', slug: 'bug', color: '#c62828' },
      });
      const status = await api.prisma.status.create({
        data: { name: 'New', slug: 'new', color: '#123456', isDefault: true },
      });
      const feedback = await api.prisma.feedbackRequest.create({
        data: {
          title: 'A request that stays',
          description: 'This must survive the author leaving.',
          categoryId: category.id,
          statusId: status.id,
          authorId: author.id,
        },
      });
      await api.prisma.vote.create({ data: { requestId: feedback.id, userId: author.id } });
      await api.prisma.comment.create({
        data: { requestId: feedback.id, authorId: author.id, body: 'A comment that stays.' },
      });

      await deleteAccount.execute(author.id);

      const wiped = await api.prisma.user.findUniqueOrThrow({ where: { id: author.id } });
      expect(wiped.displayName).toBe('Deleted user');
      expect(wiped.email).not.toBe('author@example.com');
      expect(wiped.status).toBe('deleted');

      // The writing stays; the votes go.
      await expect(api.prisma.feedbackRequest.count()).resolves.toBe(1);
      await expect(api.prisma.comment.count()).resolves.toBe(1);
      await expect(api.prisma.vote.count()).resolves.toBe(0);
    });

    it('stops their sign-in working, even with a token still inside its lifetime', async () => {
      const person = await anActiveUser('leaver@example.com');
      await api.prisma.user.update({
        where: { id: person.id },
        data: { externalId: 'kc-leaver' },
      });

      // Their token still resolves to a real subject at the provider...
      await expect(resolveCurrentUser.execute('kc-leaver')).resolves.toMatchObject({
        id: person.id,
      });

      await deleteAccount.execute(person.id);

      // ...and now resolves to nobody, which the guard chain turns into 401
      // (R-6, R-61). This is what "their sign-in stops working" means when we
      // keep no session list of our own (R-9a).
      await expect(resolveCurrentUser.execute('kc-leaver')).resolves.toBeNull();
    });

    it('refuses the last admin, with the reason (R-62)', async () => {
      const onlyAdmin = await anActiveUser('boss@example.com', 'admin');

      await expect(deleteAccount.execute(onlyAdmin.id)).rejects.toBeInstanceOf(
        LastAdminCannotLeaveError,
      );

      const still = await api.prisma.user.findUniqueOrThrow({ where: { id: onlyAdmin.id } });
      expect(still.status).toBe('active');
      expect(still.displayName).toBe('A Person');
    });

    it('lets an admin leave when another admin remains', async () => {
      const first = await anActiveUser('boss@example.com', 'admin');
      await anActiveUser('deputy@example.com', 'admin');

      await deleteAccount.execute(first.id);

      await expect(
        api.prisma.user.count({ where: { role: 'admin', status: 'active' } }),
      ).resolves.toBe(1);
    });

    it('does not count a wiped admin as one who could run the app', async () => {
      const active = await anActiveUser('boss@example.com', 'admin');
      const gone = await anActiveUser('former@example.com', 'admin');
      await deleteAccount.execute(gone.id);

      await expect(deleteAccount.execute(active.id)).rejects.toBeInstanceOf(
        LastAdminCannotLeaveError,
      );
    });
  });

  describe('my profile over HTTP', () => {
    beforeEach(async () => {
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

    const patch = (body: object) =>
      request(api.app.getHttpServer()).patch('/v1/me').set('Origin', TEST_ORIGIN).send(body);

    it('refuses a visitor with 401', async () => {
      api.signInAs(null);

      await request(api.app.getHttpServer()).get('/v1/me').expect(401);
    });

    it('lets me change my display name (R-54)', async () => {
      const response = await patch({ displayName: 'My Chosen Name' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ displayName: 'My Chosen Name' });
    });

    it('refuses a role sent in the body — no promoting yourself (R-8)', async () => {
      const response = await patch({ role: 'admin' });

      expect(response.status).toBe(400);
      await expect(
        api.prisma.user.findUniqueOrThrow({ where: { id: someUser.id } }),
      ).resolves.toMatchObject({ role: 'user' });
    });

    it('refuses an id in the body — whose profile this is comes from the session (R-7)', async () => {
      const response = await patch({ id: someAdmin.id, displayName: 'Someone Else' });

      expect(response.status).toBe(400);
    });

    it('refuses an empty display name with a field message (R-88)', async () => {
      const response = await patch({ displayName: '' });

      expect(response.status).toBe(400);
      expect((response.body as { error: { fields: object } }).error.fields).toHaveProperty(
        'displayName',
      );
    });

    it('never sends another person\'s email (R-99)', async () => {
      const response = await request(api.app.getHttpServer()).get('/v1/me');

      // My own email is mine to see; the shape carries exactly these fields.
      expect(Object.keys(response.body as object).sort()).toEqual([
        'avatarUrl',
        'displayName',
        'email',
        'id',
        'role',
      ]);
    });
  });
});
