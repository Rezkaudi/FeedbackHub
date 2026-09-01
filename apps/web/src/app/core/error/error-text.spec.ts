import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { toApiError } from './api-error';
import { ErrorText } from './error-text';
import { I18nStore } from '../i18n/i18n.store';

/**
 * The rest of the app renders whatever this returns, so it must never hand
 * back a blank string, a machine code, or a stack — and it must tell the
 * "that category is gone" case apart from a dropped connection.
 */
describe('turning a failure into words', () => {
  let text: ErrorText;
  let i18n: I18nStore;

  function wire(status: number, body: unknown): ReturnType<typeof toApiError> {
    return toApiError(new HttpErrorResponse({ status, error: body, url: '/v1/x' }));
  }

  beforeEach(() => {
    localStorage.clear();
    text = TestBed.inject(ErrorText);
    i18n = TestBed.inject(I18nStore);
  });

  it('gives a code its own sentence, not the generic fallback', () => {
    const notFound = wire(404, { error: { code: 'NOT_FOUND', message: 'Gone.', requestId: 'r' } });

    expect(text.banner(notFound)).toBe(i18n.translate('errors.notFound'));
  });

  it('shows the server sentence for a conflict, because one code covers many', () => {
    const conflict = wire(409, {
      error: { code: 'CONFLICT', message: 'That address has already been invited.', requestId: 'r' },
    });

    expect(text.banner(conflict)).toBe('That address has already been invited.');
  });

  it('names the retry time when a limit was hit', () => {
    const retryAt = new Date('2026-09-01T14:00:00.000Z');
    const limited = wire(429, {
      error: {
        code: 'SUBMISSION_RATE_LIMITED',
        message: 'Slow down.',
        requestId: 'r',
        retryAt: retryAt.toISOString(),
      },
    });
    const time = new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(retryAt);

    expect(text.banner(limited)).toBe(i18n.translate('errors.rateLimitedUntil', { time }));
    expect(text.banner(limited, { rateLimited: 'requestForm.rateLimited' })).toBe(
      i18n.translate('requestForm.rateLimited', { time }),
    );
  });

  it('falls back to the screen’s own wording for a refused form', () => {
    const refused = wire(400, {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Not valid.',
        requestId: 'r',
        fields: { categoryId: 'CATEGORY_MUST_EXIST_AND_BE_ACTIVE' },
      },
    });

    expect(text.banner(refused, { fallback: 'requestForm.saveFailed' })).toBe(
      i18n.translate('requestForm.saveFailed'),
    );
  });

  it('translates a known field code, and puts it on that field', () => {
    const refused = wire(400, {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Not valid.',
        requestId: 'r',
        fields: { categoryId: 'CATEGORY_MUST_EXIST_AND_BE_ACTIVE' },
      },
    });

    expect(text.field(refused, 'categoryId')).toBe(i18n.translate('errors.fieldCodes.categoryInactive'));
    expect(text.field(refused, 'title')).toBe('');
    expect(text.field(null, 'categoryId')).toBe('');
  });

  it('keeps an unknown field code readable rather than blank', () => {
    const refused = wire(400, {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Not valid.',
        requestId: 'r',
        fields: { title: 'title must be longer' },
      },
    });

    expect(text.field(refused, 'title')).toBe('title must be longer');
  });

  it('never returns an empty banner', () => {
    for (const status of [0, 403, 404, 409, 500, 503]) {
      expect(text.banner(wire(status, null)).length).toBeGreaterThan(0);
    }
  });
});
