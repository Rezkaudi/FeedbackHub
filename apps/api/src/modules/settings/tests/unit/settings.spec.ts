import { AppSettings } from '../../domain/entity/app-settings';
import { UserSettings } from '../../domain/entity/user-settings';
import { CODE_DEFAULTS } from '../../domain/entity/code-defaults';
import { ValidationFailedError } from '../../../../shared/errors/app-error';

/**
 * R-51: a setting is picked as code default, then user. Always in that order, in
 * one place.
 * R-42: a missing or broken switch falls back to the code default, so a bad
 * settings row can never switch something on by accident.
 */
describe('AppSettings', () => {
  it('starts from the code defaults when there is no row at all (R-42)', () => {
    const settings = AppSettings.codeDefaults();

    expect(settings.featureCommentsEnabled).toBe(true);
    expect(settings.registrationPolicy).toBe('open');
    expect(settings.submissionLimit).toEqual({ count: 10, minutes: 60 });
  });

  describe('the three limits (R-130)', () => {
    it.each([
      'signupLimitCount',
      'signupLimitMinutes',
      'submissionLimitCount',
      'submissionLimitMinutes',
      'voteLimitCount',
      'voteLimitMinutes',
    ] as const)('refuses %s of zero, which would mean nobody can write at all', (field) => {
      const settings = AppSettings.codeDefaults();

      expect(() => settings.change({ [field]: 0 })).toThrow(ValidationFailedError);
    });

    it('refuses a limit that is not a whole number', () => {
      expect(() => AppSettings.codeDefaults().change({ voteLimitCount: 2.5 })).toThrow(
        ValidationFailedError,
      );
    });

    it('accepts a raised limit, which takes effect with no restart (R-69)', () => {
      const settings = AppSettings.codeDefaults();

      settings.change({ submissionLimitCount: 50 });

      expect(settings.submissionLimit.count).toBe(50);
    });

    it('leaves a limit alone when the admin did not send it', () => {
      const settings = AppSettings.codeDefaults();

      settings.change({ voteLimitCount: 5 });

      expect(settings.voteLimit.minutes).toBe(CODE_DEFAULTS.voteLimitMinutes);
    });
  });

  describe('the sign-up rule (R-67)', () => {
    it('keeps allowed domains in small letters, so a capital cannot dodge the rule', () => {
      const settings = AppSettings.codeDefaults();

      settings.change({
        registrationPolicy: 'domain_restricted',
        allowedEmailDomains: [' Example.COM ', 'Other.test'],
      });

      expect(settings.allowedEmailDomains).toEqual(['example.com', 'other.test']);
    });

    it('refuses the domain rule with no domains, or nobody could ever join', () => {
      const settings = AppSettings.codeDefaults();

      expect(() =>
        settings.change({ registrationPolicy: 'domain_restricted', allowedEmailDomains: [] }),
      ).toThrow(ValidationFailedError);
    });

    it('allows an empty domain list when the rule does not use it', () => {
      const settings = AppSettings.codeDefaults();

      expect(() =>
        settings.change({ registrationPolicy: 'invite_only', allowedEmailDomains: [] }),
      ).not.toThrow();
    });
  });

  it('refuses a whole change when one field in it is bad, leaving nothing half-saved', () => {
    const settings = AppSettings.codeDefaults();
    const before = settings.snapshot();

    expect(() => settings.change({ featureCommentsEnabled: false, voteLimitCount: 0 })).toThrow(
      ValidationFailedError,
    );

    // SRS 15.7: the good field must not have been applied either.
    expect(settings.snapshot()).toEqual(before);
    expect(settings.featureCommentsEnabled).toBe(true);
  });

  it('leaves the sign-up rule untouched when its domain list is rejected', () => {
    const settings = AppSettings.codeDefaults();

    expect(() =>
      settings.change({ registrationPolicy: 'domain_restricted', allowedEmailDomains: [] }),
    ).toThrow(ValidationFailedError);

    expect(settings.registrationPolicy).toBe('open');
  });
});

describe('UserSettings', () => {
  it('falls back to the code default when the person changed nothing (R-51)', () => {
    const settings = UserSettings.defaultsFor('user-1');

    expect(settings.storedLanguage).toBeNull();
    expect(settings.language).toBe('en');
    expect(settings.notifyOnComment).toBe(true);
    expect(settings.notifyOnStatusChange).toBe(true);
  });

  it('lets the person win over the code default', () => {
    const settings = UserSettings.defaultsFor('user-1');

    settings.change({ language: 'ar' });

    expect(settings.language).toBe('ar');
  });

  it('goes back to the code default when the person clears their choice', () => {
    const settings = UserSettings.rehydrate({
      userId: 'user-1',
      language: 'ar',
      notifyOnComment: true,
      notifyOnStatusChange: true,
    });

    settings.change({ language: null });

    expect(settings.language).toBe('en');
  });

  it('turns an email choice off', () => {
    const settings = UserSettings.defaultsFor('user-1');

    settings.change({ notifyOnComment: false });

    expect(settings.notifyOnComment).toBe(false);
    // The other one is untouched: they are two separate choices (R-59).
    expect(settings.notifyOnStatusChange).toBe(true);
  });

  it('holds no theme, sort or filter — those live in the browser (R-60, D-06)', () => {
    const snapshot = UserSettings.defaultsFor('user-1').snapshot();

    expect(Object.keys(snapshot).sort()).toEqual([
      'language',
      'notifyOnComment',
      'notifyOnStatusChange',
      'userId',
    ]);
  });
});
