import { attachRequestId, readRequestId, REQUEST_ID_HEADER } from './request-id';

/**
 * R-119: logs carry an id that follows one call through the system.
 * R-100: the person is given that id, so support can find the full story.
 */
describe('the request id', () => {
  const makeRequest = (headers: Record<string, string> = {}): Record<string, unknown> => ({
    headers,
  });

  it('makes a fresh id when the caller sent none', () => {
    const request = makeRequest();

    const id = attachRequestId(request);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(readRequestId(request)).toBe(id);
  });

  it('makes a different id for every call', () => {
    expect(attachRequestId(makeRequest())).not.toBe(attachRequestId(makeRequest()));
  });

  it('keeps an id the caller sent, so one id spans the API and the worker', () => {
    const request = makeRequest({ [REQUEST_ID_HEADER]: '11111111-2222-3333-4444-555555555555' });

    expect(attachRequestId(request)).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('refuses a caller id that is not a plain uuid, so nothing can be smuggled into a log', () => {
    const request = makeRequest({ [REQUEST_ID_HEADER]: 'not a uuid\n INJECTED LOG LINE' });

    const id = attachRequestId(request);

    expect(id).not.toContain('INJECTED');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gives a readable fallback rather than throwing when no id was attached', () => {
    expect(readRequestId(makeRequest())).toBe('unknown');
  });
});
