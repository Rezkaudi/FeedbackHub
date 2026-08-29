/**
 * Layer one of R-51: the value we ship with.
 *
 * The order is code default, then user setting, and the last one filled in wins.
 * This file is the first layer, in one place, so "what happens when nothing is
 * set" has exactly one answer (R-150).
 *
 * These are *product* defaults and deliberately live in code, not in the
 * environment (R-53). The admin overrides them in `app_settings` at runtime; the
 * person who runs the servers never does.
 */
export const CODE_DEFAULTS = {
  /** R-67. Open until an admin says otherwise. */
  registrationPolicy: 'open',
  allowedEmailDomains: [] as readonly string[],
  /** R-40. Off, so comments appear at once unless an admin asks for review. */
  commentsRequireApproval: false,

  /** R-130. The three sliding windows. */
  signupLimitCount: 20,
  signupLimitMinutes: 60,
  submissionLimitCount: 10,
  submissionLimitMinutes: 60,
  voteLimitCount: 100,
  voteLimitMinutes: 60,

  /**
   * R-42. On. A missing or broken settings row falls back to this, so a bad row
   * can never switch something *on* by accident — and never silently switches
   * comments off either.
   */
  featureCommentsEnabled: true,

  /** R-57. A missing word shows in English, never as a code word. */
  language: 'en',
  /** R-59. Both email choices start on. */
  notifyOnComment: true,
  notifyOnStatusChange: true,
} as const;

export type Language = 'en' | 'ar';
export type RegistrationPolicy = 'open' | 'invite_only' | 'domain_restricted';
