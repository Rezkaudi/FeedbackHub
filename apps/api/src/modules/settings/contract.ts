/** What the settings module promises other modules (R-141). Plain data only. */
export interface RateLimitView {
  readonly count: number;
  readonly minutes: number;
}

export interface AppSettingsView {
  readonly registrationPolicy: 'open' | 'invite_only' | 'domain_restricted';
  readonly allowedEmailDomains: readonly string[];
  readonly commentsRequireApproval: boolean;
  readonly featureCommentsEnabled: boolean;
  readonly signupLimit: RateLimitView;
  readonly submissionLimit: RateLimitView;
  readonly voteLimit: RateLimitView;
}

/** Already resolved: code default, then the person's own choice (R-51). */
export interface MySettingsView {
  readonly language: 'en' | 'ar';
  readonly notifyOnComment: boolean;
  readonly notifyOnStatusChange: boolean;
}
