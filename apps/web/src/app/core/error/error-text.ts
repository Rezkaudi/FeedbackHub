import { Injectable, inject } from '@angular/core';
import { I18nStore, type TranslationKey } from '../i18n/i18n.store';
import type { ApiError, ApiErrorCode } from './api-error';

/**
 * One place that turns an {@link ApiError} into words a person can act on.
 *
 * Every store already produces a full `ApiError` (a machine code, the field
 * names when a form was refused, a retry time when a limit was hit). Before
 * this, each template re-decided what to show from `status === 403` / `409`
 * guesses and mostly fell back to one generic sentence — so a "that category
 * is gone" refusal read the same as a dropped connection, and a field error
 * showed as a form-wide banner. This maps `code` (and the field codes) to the
 * `errors.*` dictionary block once, and every screen asks it the same two
 * questions: what do I put in the banner, and what do I put on this field.
 *
 * `CONFLICT` is the exception: the server sends one code for several different
 * refusals, each with its own specific English sentence ("That address has
 * already been invited", "This category is used by requests, retire it
 * instead"). We show that sentence rather than a vague translated one — see
 * DECISIONS.md; the trade-off is that those few admin-only messages stay
 * English until the API grows granular codes.
 */

const CODE_KEY: Partial<Record<ApiErrorCode, TranslationKey>> = {
  NETWORK_UNAVAILABLE: 'errors.network',
  NOT_FOUND: 'errors.notFound',
  FORBIDDEN: 'errors.forbidden',
  UNAUTHORIZED: 'errors.unauthorized',
  FEATURE_DISABLED: 'errors.featureDisabled',
  SERVICE_UNAVAILABLE: 'errors.serviceUnavailable',
  INTERNAL_ERROR: 'errors.internal',
  VALIDATION_FAILED: 'errors.validation',
  TOO_MANY_REQUESTS: 'errors.tooManyRequests',
  SIGNUP_RATE_LIMITED: 'errors.tooManyRequests',
  SUBMISSION_RATE_LIMITED: 'errors.tooManyRequests',
  VOTE_RATE_LIMITED: 'errors.tooManyRequests',
};

/** Server-side field codes we translate. Anything unknown falls back to the
 * raw string the server sent, so a new one is readable, not blank. */
const FIELD_CODE_KEY: Record<string, TranslationKey> = {
  CATEGORY_MUST_EXIST_AND_BE_ACTIVE: 'errors.fieldCodes.categoryInactive',
};

export interface BannerOptions {
  /** Shown when the code has no specific message of its own — keep each
   * screen's own "what you typed is still here" phrasing. */
  readonly fallback?: TranslationKey;
  /** Shown when a rate limit named a time to try again. Lets a screen keep a
   * richer sentence than the generic one. */
  readonly rateLimited?: TranslationKey;
}

@Injectable({ providedIn: 'root' })
export class ErrorText {
  private readonly i18n = inject(I18nStore);

  /** The one line a form-level banner or inline alert should show. */
  public banner(error: ApiError, options: BannerOptions = {}): string {
    const fallback = options.fallback ?? 'errors.generic';

    if (error.retryAt !== undefined) {
      const time = this.timeOf(error.retryAt);
      return options.rateLimited !== undefined
        ? this.i18n.translate(options.rateLimited, { time })
        : this.i18n.translate('errors.rateLimitedUntil', { time });
    }

    if (error.code === 'CONFLICT') {
      return error.message.trim().length > 0
        ? error.message
        : this.i18n.translate('errors.conflict');
    }

    // A refused form shows its problems on the fields; the banner just needs a
    // line, and the screen's own wording is friendlier than "check the fields".
    if (error.code === 'VALIDATION_FAILED' && error.fields !== undefined) {
      return this.i18n.translate(fallback);
    }

    const key = CODE_KEY[error.code];
    return this.i18n.translate(key ?? fallback);
  }

  /** What to show next to one field, or '' when the server did not name it. */
  public field(error: ApiError | null | undefined, name: string): string {
    const raw = error?.fields?.[name];
    if (raw === undefined) {
      return '';
    }
    const key = FIELD_CODE_KEY[raw];
    return key !== undefined ? this.i18n.translate(key) : raw;
  }

  private timeOf(at: Date): string {
    return new Intl.DateTimeFormat(this.i18n.language(), { timeStyle: 'short' }).format(at);
  }
}
