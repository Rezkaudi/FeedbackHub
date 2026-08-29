import { checkMayJoin } from '../../domain/entity/registration-rule';
import { DELETED_USER_NAME, User } from '../../domain/entity/user';
import { SignupNotAllowed } from '../../domain/error/identity-errors';
import { ValidationFailedError } from '../../../../shared/errors/app-error';

/**
 * R-67 (the sign-up rule) and R-61 (deleting an account), both decided with no
 * database and no clock (R-152).
 */
describe('the sign-up rule (R-67)', () => {
  const verified = { email: 'someone@example.com', emailVerified: true };
  const unverified = { email: 'someone@example.com', emailVerified: false };

  describe('open', () => {
    it('lets anybody in', () => {
      expect(() =>
        checkMayJoin(unverified, { policy: 'open', allowedDomains: [], hasInvitation: false }),
      ).not.toThrow();
    });
  });

  describe('invite only', () => {
    const rule = (hasInvitation: boolean) =>
      ({ policy: 'invite_only', allowedDomains: [], hasInvitation }) as const;

    it('lets an invited person in', () => {
      expect(() => checkMayJoin(verified, rule(true))).not.toThrow();
    });

    it('refuses someone with no invitation', () => {
      expect(() => checkMayJoin(verified, rule(false))).toThrow(SignupNotAllowed);
    });
  });

  describe('only these email domains', () => {
    const rule = {
      policy: 'domain_restricted',
      allowedDomains: ['example.com'],
      hasInvitation: false,
    } as const;

    it('lets in a checked email on an allowed domain', () => {
      expect(() => checkMayJoin(verified, rule)).not.toThrow();
    });

    it('refuses a checked email on another domain', () => {
      const other = { email: 'someone@other.com', emailVerified: true };

      expect(() => checkMayJoin(other, rule)).toThrow(
        expect.objectContaining({ reason: 'policy_domain' }) as Error,
      );
    });

    it('refuses an UNCHECKED email even on an allowed domain, and says why', () => {
      // An unchecked email is a claim, not a fact. Saying "wrong domain" here
      // would be untrue and would send the person looking in the wrong place.
      expect(() => checkMayJoin(unverified, rule)).toThrow(
        expect.objectContaining({ reason: 'email_not_verified' }) as Error,
      );
    });

    it('matches the domain whatever the capitals', () => {
      const shouty = { email: 'Someone@EXAMPLE.com', emailVerified: true };

      expect(() => checkMayJoin(shouty, rule)).not.toThrow();
    });

    it('is not fooled by a domain that only looks like an allowed one', () => {
      const lookalike = { email: 'someone@notexample.com', emailVerified: true };

      expect(() => checkMayJoin(lookalike, rule)).toThrow(SignupNotAllowed);
    });

    it('is not fooled by an allowed domain appearing earlier in the address', () => {
      const sneaky = { email: 'example.com@evil.test', emailVerified: true };

      expect(() => checkMayJoin(sneaky, rule)).toThrow(SignupNotAllowed);
    });
  });
});

describe('User', () => {
  const aUser = (): User =>
    User.createFromProvider(
      {
        externalId: 'kc-1',
        email: '  Person@Example.COM ',
        emailVerified: true,
        displayName: '  A Person  ',
        avatarUrl: null,
      },
      'user-1',
    );

  it('stores the email in small letters and trims the name', () => {
    const user = aUser();

    expect(user.email).toBe('person@example.com');
    expect(user.displayName).toBe('A Person');
  });

  it('is never an admin by accident (R-8)', () => {
    expect(aUser().role).toBe('user');
  });

  it('refuses an empty display name (SRS 12.1)', () => {
    expect(() => aUser().changeProfile({ displayName: '   ' })).toThrow(ValidationFailedError);
  });

  it('refuses a display name over 80 letters', () => {
    expect(() => aUser().changeProfile({ displayName: 'x'.repeat(81) })).toThrow(
      ValidationFailedError,
    );
  });

  it('treats an empty picture as no picture, so initials are drawn (R-54)', () => {
    const user = aUser();

    user.changeProfile({ avatarUrl: '   ' });

    expect(user.avatarUrl).toBeNull();
  });

  describe('deleting an account (R-61)', () => {
    it('wipes the name, the picture and the email, and stops the sign-in working', () => {
      const user = aUser();

      user.wipe(new Date('2026-08-29T12:00:00Z'));

      expect(user.displayName).toBe(DELETED_USER_NAME);
      expect(user.avatarUrl).toBeNull();
      expect(user.email).not.toContain('person@example.com');
      // The provider link is broken, so signing in again makes a fresh record
      // rather than walking back into a wiped one.
      expect(user.externalId).not.toBe('kc-1');
      expect(user.isActive).toBe(false);
    });

    it('keeps the row, because requests and comments still point at it', () => {
      const user = aUser();

      user.wipe(new Date());

      expect(user.id).toBe('user-1');
    });

    it('leaves an email that is still unique, so someone else can join with theirs', () => {
      const first = aUser();
      const second = User.createFromProvider(
        { externalId: 'kc-2', email: 'other@example.com', emailVerified: true, displayName: 'B' },
        'user-2',
      );

      first.wipe(new Date());
      second.wipe(new Date());

      expect(first.email).not.toBe(second.email);
    });
  });

  describe('what the provider is allowed to overwrite', () => {
    it('refreshes the email, which can go out of date at the provider', () => {
      const user = aUser();

      user.refreshFromProvider({ email: 'new@example.com', emailVerified: false });

      expect(user.email).toBe('new@example.com');
      expect(user.emailVerified).toBe(false);
    });

    it('never overwrites a display name the person chose here (R-54)', () => {
      const user = aUser();
      user.changeProfile({ displayName: 'My Chosen Name' });

      user.refreshFromProvider({
        email: 'person@example.com',
        emailVerified: true,
        displayName: 'Name From Keycloak',
      });

      expect(user.displayName).toBe('My Chosen Name');
    });

    it('never changes the role: that is ours, from the saved row (R-7, R-8)', () => {
      const admin = User.rehydrate({ ...aUser().snapshot(), role: 'admin' });

      admin.refreshFromProvider({ email: 'person@example.com', emailVerified: true });

      expect(admin.role).toBe('admin');
    });
  });
});
