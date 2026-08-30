import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

/**
 * R-76: the server has one error shape, and it is the same shape every time —
 * a machine code the app turns into words in the person's language, an English
 * message for the logs, field names when a form is wrong, and an id to quote to
 * support.
 *
 * This turns that shape, or anything else that arrives instead of it, into one
 * type the rest of the app can rely on. Everything downstream — the retry
 * button, the inline field messages, the rate-limit countdown — reads this and
 * never an HttpErrorResponse, so there is exactly one place that has to know
 * what a failure looks like on the wire (R-150).
 */
describe('a failure, as the app sees it', () => {
  function wireError(status: number, body: unknown): HttpErrorResponse {
    return new HttpErrorResponse({ status, error: body, url: '/v1/requests' });
  }

  it('keeps the code, the message and the id the server sent', () => {
    const error = toApiError(
      wireError(404, {
        error: { code: 'NOT_FOUND', message: 'Feedback request was not found.', requestId: 'req_1' },
      }),
    );

    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Feedback request was not found.');
    expect(error.requestId).toBe('req_1');
    expect(error.status).toBe(404);
  });

  /** R-88: a form message sits next to its field, so the fields must survive. */
  it('keeps the field names when a form was refused', () => {
    const error = toApiError(
      wireError(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'The submitted values are not valid.',
          requestId: 'req_2',
          fields: { title: 'title must be longer than or equal to 5 characters' },
        },
      }),
    );

    expect(error.fields).toEqual({
      title: 'title must be longer than or equal to 5 characters',
    });
  });

  /** R-131: the refusal names the time they may try again, and we must show it. */
  it('reads the retry time as a date, not a string', () => {
    const error = toApiError(
      wireError(429, {
        error: {
          code: 'SUBMISSION_RATE_LIMITED',
          message: 'You have reached the limit.',
          requestId: 'req_3',
          retryAt: '2026-08-30T14:00:00.000Z',
        },
      }),
    );

    expect(error.retryAt).toEqual(new Date('2026-08-30T14:00:00.000Z'));
  });

  it('has no retry time when the server sent none', () => {
    const error = toApiError(
      wireError(403, { error: { code: 'FORBIDDEN', message: 'No.', requestId: 'r' } }),
    );

    expect(error.retryAt).toBeUndefined();
  });

  describe('when what came back is not the shape we were promised', () => {
    /**
     * A proxy, a gateway or a dev server can answer instead of the API. The app
     * must still have something to show, and must never render `undefined`.
     */
    it('falls back to a usable error for an HTML error page', () => {
      const error = toApiError(wireError(502, '<html>Bad Gateway</html>'));

      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.status).toBe(502);
    });

    it('falls back for a body that is JSON but not our shape', () => {
      const error = toApiError(wireError(500, { detail: 'something else entirely' }));

      expect(error.code).toBe('INTERNAL_ERROR');
    });

    /**
     * status 0 is the browser refusing to tell us why: offline, DNS, CORS, a
     * blocked request. It is worth its own code, because it is the one failure
     * where "try again" is genuinely likely to help.
     */
    it('recognises no answer at all as an offline failure', () => {
      const error = toApiError(wireError(0, null));

      expect(error.code).toBe('NETWORK_UNAVAILABLE');
      expect(error.isRetryable).toBe(true);
    });

    it('survives something that is not an HttpErrorResponse at all', () => {
      const error = toApiError(new TypeError('undefined is not a function'));

      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.status).toBe(0);
    });
  });

  /**
   * R-87: an error says whether trying again helps. The retry button is shown
   * from this, so guessing would mean offering a retry that cannot work — or
   * hiding one that would.
   */
  describe('whether trying again can help', () => {
    it('says yes for a server fault and for being offline', () => {
      expect(toApiError(wireError(500, null)).isRetryable).toBe(true);
      expect(toApiError(wireError(503, null)).isRetryable).toBe(true);
      expect(toApiError(wireError(0, null)).isRetryable).toBe(true);
    });

    it('says no for a refusal that will refuse again', () => {
      const forbidden = wireError(403, {
        error: { code: 'FORBIDDEN', message: 'No.', requestId: 'r' },
      });
      const missing = wireError(404, {
        error: { code: 'NOT_FOUND', message: 'Gone.', requestId: 'r' },
      });

      expect(toApiError(forbidden).isRetryable).toBe(false);
      expect(toApiError(missing).isRetryable).toBe(false);
    });

    it('says no for a rate limit, because the button is a countdown instead', () => {
      const limited = wireError(429, {
        error: { code: 'VOTE_RATE_LIMITED', message: 'Slow down.', requestId: 'r' },
      });

      expect(toApiError(limited).isRetryable).toBe(false);
    });
  });

  /** R-100: the server never leaks its insides, and neither do we. */
  it('never carries a stack into anything a screen could render', () => {
    const error = toApiError(new TypeError('boom at Object.<anonymous> (/app/src/x.ts:1:1)'));

    expect(JSON.stringify(error)).not.toContain('/app/src');
    expect(error.message).not.toContain('/app/src');
  });
});
