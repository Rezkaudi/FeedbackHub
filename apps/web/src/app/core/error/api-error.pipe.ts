import { Pipe, PipeTransform, inject } from '@angular/core';
import type { TranslationKey } from '../i18n/i18n.store';
import type { ApiError } from './api-error';
import { ErrorText } from './error-text';

/**
 * `{{ store.actionError() | apiError: 'admin.actionFailed' }}` — the banner
 * text for a failed call, from the one mapping in {@link ErrorText}. Impure
 * like the `t` pipe, so it re-renders when the language changes.
 *
 * `fallback` is the key to use when the error's code has no message of its own
 * (keep each screen's own "what you typed is still here" wording). `rateLimited`
 * is the key for a limit that named a time to try again.
 */
@Pipe({ name: 'apiError', pure: false })
export class ApiErrorPipe implements PipeTransform {
  private readonly text = inject(ErrorText);

  public transform(
    error: ApiError | null | undefined,
    fallback?: TranslationKey,
    rateLimited?: TranslationKey,
  ): string {
    return error ? this.text.banner(error, { fallback, rateLimited }) : '';
  }
}
