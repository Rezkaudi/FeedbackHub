import { ADMIN } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api, apiPatch, apiPost, apiDelete } from '../../support/clients/api.client';
import { SEED } from '../../support/fixtures/seed-ids';

const FOREIGN = 'https://not-an-allowed-origin.example';

describe('the OriginGuard on every write verb', () => {
  // beforeEach, not before: testIsolation clears cookies between tests, and
  // these tests hit the API with raw cy.request() (no cy.visitAs() to
  // re-establish the session) — a session signed in only once in `before()`
  // would be gone by the second test, and every raw request would 401.
  beforeEach(() => {
    cy.signIn(ADMIN);
  });

  it('POST /v1/requests with no Origin is 403; a foreign Origin is also 403', () => {
    api.bootstrap().then((boot) => {
      const categoryId = boot.categories.find((c) => c.isActive)!.id;
      const body = { title: 'origin guard test', description: 'x'.repeat(20), categoryId };
      apiPost('/requests', body, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
      apiPost('/requests', body, { origin: FOREIGN, failOnStatusCode: false }).its('status').should('eq', 403);
    });
  });

  it('PATCH /v1/requests/:id, /status, /pin all require a real Origin', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      apiPatch(`/requests/${request.id}`, { title: 'x' }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
      apiPatch(`/requests/${request.id}/status`, { statusId: request.statusId }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
      apiPatch(`/requests/${request.id}/pin`, { pinned: true }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    });
  });

  it('DELETE /v1/requests/:id requires a real Origin', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      apiDelete(`/requests/${request.id}`, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    });
  });

  it('vote POST and DELETE require a real Origin', () => {
    apiPost(`/requests/${SEED.requests.darkMode}/vote`, undefined, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    apiDelete(`/requests/${SEED.requests.darkMode}/vote`, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
  });

  it('comment POST/PATCH/DELETE require a real Origin', () => {
    apiPost(`/requests/${SEED.requests.darkMode}/comments`, { body: 'x' }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    apiPatch('/comments/00000000-0000-4000-8000-000000000000', { body: 'x' }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    apiDelete('/comments/00000000-0000-4000-8000-000000000000', { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
  });

  it('taxonomy writes require a real Origin', () => {
    apiPost('/taxonomy/categories', { name: 'x', color: '#000000' }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    apiPost('/taxonomy/statuses', { name: 'x', color: '#000000' }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
  });

  it('settings PATCH (app and me) requires a real Origin', () => {
    apiPatch('/settings/app', {}, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    apiPatch('/settings/me', {}, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
  });

  it('invitations POST/DELETE require a real Origin', () => {
    apiPost('/invitations', { email: 'origin-guard@feedbackhub.test' }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    apiDelete('/invitations/00000000-0000-4000-8000-000000000000', { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
  });

  it('PATCH/DELETE /v1/me require a real Origin', () => {
    apiPatch('/me', { displayName: 'x' }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    apiDelete('/me', { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
  });

  it('POST /v1/auth/refresh and /v1/auth/sign-out require a real Origin despite being @Public()', () => {
    apiPost('/auth/refresh', undefined, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
    apiPost('/auth/sign-out', undefined, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
  });

  it('a GET with a foreign Origin is unaffected', () => {
    cy.request({ url: '/v1/requests', headers: { origin: FOREIGN } }).its('status').should('eq', 200);
  });

  it('a refused write actually did nothing — a re-read proves it', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      apiPatch(`/requests/${request.id}`, { title: 'should never apply' }, { origin: false, failOnStatusCode: false }).its('status').should('eq', 403);
      api.requests.read(request.id).its('title').should('eq', request.title);
    });
  });
});
