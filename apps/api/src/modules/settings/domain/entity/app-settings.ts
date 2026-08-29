import { ValidationFailedError } from '../../../../shared/errors/app-error';
import { CODE_DEFAULTS, RegistrationPolicy } from './code-defaults';

export interface AppSettingsState {
  registrationPolicy: RegistrationPolicy;
  allowedEmailDomains: string[];
  commentsRequireApproval: boolean;
  signupLimitCount: number;
  signupLimitMinutes: number;
  submissionLimitCount: number;
  submissionLimitMinutes: number;
  voteLimitCount: number;
  voteLimitMinutes: number;
  featureCommentsEnabled: boolean;
}

/** R-130: every limit is 1 or more. Zero would mean nobody can write at all. */
function checkLimit(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new ValidationFailedError({ [field]: 'MUST_BE_A_WHOLE_NUMBER_1_OR_MORE' });
  }
  return value;
}

/**
 * The one row an admin edits while the app runs (R-69, R-70).
 *
 * Nothing here comes from the environment, and nothing here is a server address
 * or a secret — that separation is R-53, and it is what lets an admin retune a
 * limit without a deploy.
 */
export class AppSettings {
  private constructor(private readonly state: AppSettingsState) {}

  /** What the app uses when there is no row at all, or the row cannot be read. */
  public static codeDefaults(): AppSettings {
    return new AppSettings({
      registrationPolicy: CODE_DEFAULTS.registrationPolicy,
      allowedEmailDomains: [...CODE_DEFAULTS.allowedEmailDomains],
      commentsRequireApproval: CODE_DEFAULTS.commentsRequireApproval,
      signupLimitCount: CODE_DEFAULTS.signupLimitCount,
      signupLimitMinutes: CODE_DEFAULTS.signupLimitMinutes,
      submissionLimitCount: CODE_DEFAULTS.submissionLimitCount,
      submissionLimitMinutes: CODE_DEFAULTS.submissionLimitMinutes,
      voteLimitCount: CODE_DEFAULTS.voteLimitCount,
      voteLimitMinutes: CODE_DEFAULTS.voteLimitMinutes,
      featureCommentsEnabled: CODE_DEFAULTS.featureCommentsEnabled,
    });
  }

  public static rehydrate(state: AppSettingsState): AppSettings {
    return new AppSettings({ ...state, allowedEmailDomains: [...state.allowedEmailDomains] });
  }

  public get registrationPolicy(): RegistrationPolicy {
    return this.state.registrationPolicy;
  }
  public get allowedEmailDomains(): readonly string[] {
    return this.state.allowedEmailDomains;
  }
  public get commentsRequireApproval(): boolean {
    return this.state.commentsRequireApproval;
  }
  public get featureCommentsEnabled(): boolean {
    return this.state.featureCommentsEnabled;
  }
  public get signupLimit(): { count: number; minutes: number } {
    return { count: this.state.signupLimitCount, minutes: this.state.signupLimitMinutes };
  }
  public get submissionLimit(): { count: number; minutes: number } {
    return { count: this.state.submissionLimitCount, minutes: this.state.submissionLimitMinutes };
  }
  public get voteLimit(): { count: number; minutes: number } {
    return { count: this.state.voteLimitCount, minutes: this.state.voteLimitMinutes };
  }

  /**
   * SRS 15.7: "No half-saved settings." Everything is checked before anything is
   * applied, so a change with one bad field leaves the settings exactly as they
   * were rather than partly updated.
   */
  public change(changes: Partial<AppSettingsState>): void {
    const limitFields = [
      'signupLimitCount',
      'signupLimitMinutes',
      'submissionLimitCount',
      'submissionLimitMinutes',
      'voteLimitCount',
      'voteLimitMinutes',
    ] as const;

    // --- check everything first ------------------------------------------
    for (const field of limitFields) {
      const value = changes[field];
      if (value !== undefined) {
        checkLimit(value, field);
      }
    }

    const nextPolicy = changes.registrationPolicy ?? this.state.registrationPolicy;
    const nextDomains =
      changes.allowedEmailDomains?.map((d) => d.trim().toLowerCase()) ??
      this.state.allowedEmailDomains;

    // R-67: the domain rule needs at least one domain, or nobody could ever join.
    if (nextPolicy === 'domain_restricted' && nextDomains.length === 0) {
      throw new ValidationFailedError({
        allowedEmailDomains: 'AT_LEAST_ONE_DOMAIN_IS_NEEDED_FOR_THIS_POLICY',
      });
    }

    // --- only now, apply --------------------------------------------------
    this.state.registrationPolicy = nextPolicy;
    // R-67: kept in small letters, so the rule cannot be dodged with a capital.
    this.state.allowedEmailDomains = [...nextDomains];

    if (changes.commentsRequireApproval !== undefined) {
      this.state.commentsRequireApproval = changes.commentsRequireApproval;
    }
    if (changes.featureCommentsEnabled !== undefined) {
      this.state.featureCommentsEnabled = changes.featureCommentsEnabled;
    }

    for (const field of limitFields) {
      const value = changes[field];
      if (value !== undefined) {
        this.state[field] = value;
      }
    }
  }

  public snapshot(): Readonly<AppSettingsState> {
    return { ...this.state, allowedEmailDomains: [...this.state.allowedEmailDomains] };
  }
}
