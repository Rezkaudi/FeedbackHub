import { ADMIN } from '../../support/fixtures/accounts';
import { api, apiPatch, apiPost } from '../../support/clients/api.client';
import type { ApiErrorBody } from '../../support/utils/types';

describe('validation and id handling', () => {
  // beforeEach, not before — see the comment in 08-02-origin-guard.cy.ts:
  // testIsolation clears cookies between tests, and a session signed in once
  // in `before()` would be gone before the second raw cy.request() test runs.
  beforeEach(() => {
    cy.signIn(ADMIN);
  });

  it('an unknown field on every major write DTO is rejected with VALIDATION_FAILED', () => {
    api.bootstrap().then((boot) => {
      const categoryId = boot.categories.find((c) => c.isActive)!.id;
      apiPost('/requests', { title: 'x'.repeat(10), description: 'x'.repeat(20), categoryId, extra: 1 }, { failOnStatusCode: false }).its('status').should('eq', 400);
      apiPatch('/me', { displayName: 'x', extra: 1 }, { failOnStatusCode: false }).its('status').should('eq', 400);
      apiPatch('/settings/me', { language: 'en', extra: 1 }, { failOnStatusCode: false }).its('status').should('eq', 400);
      apiPatch('/settings/app', { featureCommentsEnabled: true, extra: 1 }, { failOnStatusCode: false }).its('status').should('eq', 400);
      apiPost('/taxonomy/categories', { name: 'x', color: '#000000', extra: 1 }, { failOnStatusCode: false }).its('status').should('eq', 400);
      apiPost('/taxonomy/statuses', { name: 'x', color: '#000000', extra: 1 }, { failOnStatusCode: false }).its('status').should('eq', 400);
      apiPost('/invitations', { email: 'x@x.com', extra: 1 }, { failOnStatusCode: false }).its('status').should('eq', 400);
    });
  });

  it('missing required fields name the field in the error', () => {
    apiPost('/requests', {}, { failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(400);
      const fields = (response.body as unknown as ApiErrorBody).error.fields ?? {};
      expect(Object.keys(fields)).to.include.members(['title', 'description', 'categoryId']);
    });
  });

  it('wrong types are rejected', () => {
    apiPost('/requests', { title: 12345, description: 'x'.repeat(20), categoryId: 'x' }, { failOnStatusCode: false }).its('status').should('eq', 400);
    apiPatch('/settings/app', { featureCommentsEnabled: 'yes' }, { failOnStatusCode: false }).its('status').should('eq', 400);
  });

  it('title and description length bounds are enforced at the edges', () => {
    api.bootstrap().then((boot) => {
      const categoryId = boot.categories.find((c) => c.isActive)!.id;
      apiPost('/requests', { title: 'x'.repeat(5), description: 'x'.repeat(10), categoryId }).then((response) => {
        expect(response.status).to.eq(201);
        api.requests.remove((response.body as { id: string }).id);
      });
      apiPost('/requests', { title: 'x'.repeat(4), description: 'x'.repeat(10), categoryId }, { failOnStatusCode: false }).its('status').should('eq', 400);
      apiPost('/requests', { title: 'x'.repeat(120), description: 'x'.repeat(10), categoryId }).then((response) => {
        expect(response.status).to.eq(201);
        api.requests.remove((response.body as { id: string }).id);
      });
      apiPost('/requests', { title: 'x'.repeat(121), description: 'x'.repeat(10), categoryId }, { failOnStatusCode: false }).its('status').should('eq', 400);
    });
  });

  it('a non-UUID :id is 400 on a representative sample of parameterised routes', () => {
    cy.request({ url: '/v1/requests/not-a-uuid', failOnStatusCode: false }).its('status').should('eq', 400);
    apiPatch('/requests/not-a-uuid', { title: 'x' }, { failOnStatusCode: false }).its('status').should('eq', 400);
    apiPatch('/comments/not-a-uuid', { body: 'x' }, { failOnStatusCode: false }).its('status').should('eq', 400);
    apiPost('/taxonomy/categories/not-a-uuid/retire', undefined, { failOnStatusCode: false }).its('status').should('eq', 400);
  });

  it('a well-formed but unknown UUID is 404, not 400', () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    cy.request({ url: `/v1/requests/${unknown}`, failOnStatusCode: false }).its('status').should('eq', 404);
  });

  it('a 400 response never leaks a stack trace or a SQL fragment', () => {
    apiPost('/requests', {}, { failOnStatusCode: false }).then((response) => {
      const text = JSON.stringify(response.body);
      expect(text).to.not.match(/at .*\.(ts|js):\d+/);
      expect(text.toLowerCase()).to.not.include('select ');
    });
  });

  it('display name and category name length bounds', () => {
    apiPatch('/me', { displayName: 'x'.repeat(80) }).its('status').should('eq', 200);
    apiPatch('/me', { displayName: 'x'.repeat(81) }, { failOnStatusCode: false }).its('status').should('eq', 400);
    apiPatch('/me', { displayName: 'Ada Admin' }); // restore

    apiPost('/taxonomy/categories', { name: 'x'.repeat(40), color: '#000000' }).then((response) => {
      expect(response.status).to.eq(201);
      api.taxonomy.categories.remove((response.body as { id: string }).id);
    });
    apiPost('/taxonomy/categories', { name: 'y'.repeat(41), color: '#000000' }, { failOnStatusCode: false }).its('status').should('eq', 400);
  });
});
