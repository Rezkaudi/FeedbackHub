import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { makeRequest, makeComment } from '../../support/fixtures/entities.fixture';
import { apiGet, apiPatch, apiPost, apiDelete } from '../../support/clients/api.client';

/**
 * One table-driven spec covering the read-only, always-true parts of the
 * permission surface: anonymous (401 everywhere except @Public() routes and
 * health) vs a signed-in non-admin (403 on every admin-only route). Routes
 * whose correct behaviour depends on live fixture state (author-vs-stranger
 * on a specific request/comment, rate limits, etc.) are covered by their own
 * domain specs instead of duplicated here.
 */
describe('permission matrix: anonymous and non-admin', () => {
  const PUBLIC_ROUTES: readonly { method: 'GET' | 'POST'; path: string }[] = [
    { method: 'GET', path: '/health/live' },
    { method: 'GET', path: '/health/ready' },
  ];

  const AUTHENTICATED_GET_ROUTES = ['/bootstrap', '/requests', '/me', '/settings/me'];

  const ADMIN_ONLY_ROUTES: readonly { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; body?: unknown }[] = [
    { method: 'GET', path: '/taxonomy' },
    { method: 'POST', path: '/taxonomy/categories', body: { name: 'x', color: '#000000' } },
    { method: 'POST', path: '/taxonomy/statuses', body: { name: 'x', color: '#000000' } },
    { method: 'GET', path: '/settings/app' },
    { method: 'PATCH', path: '/settings/app', body: {} },
    { method: 'GET', path: '/invitations' },
    { method: 'POST', path: '/invitations', body: { email: 'matrix@feedbackhub.test' } },
    { method: 'DELETE', path: '/invitations/00000000-0000-4000-8000-000000000000' },
    { method: 'GET', path: '/admin/comments/pending' },
    { method: 'POST', path: '/admin/comments/00000000-0000-4000-8000-000000000000/approve' },
    { method: 'POST', path: '/admin/comments/00000000-0000-4000-8000-000000000000/reject' },
  ];

  for (const route of PUBLIC_ROUTES) {
    it(`${route.method} ${route.path} needs no session`, () => {
      cy.request({ method: route.method, url: route.path }).its('status').should('eq', 200);
    });
  }

  for (const path of AUTHENTICATED_GET_ROUTES) {
    it(`GET /v1${path} is 401 for an anonymous caller`, () => {
      cy.clearCookies();
      cy.request({ url: `/v1${path}`, failOnStatusCode: false }).its('status').should('eq', 401);
    });
  }

  for (const route of ADMIN_ONLY_ROUTES) {
    it(`${route.method} /v1${route.path} is 401 anonymous, 403 for a non-admin, 200/201/204/404 for an admin`, () => {
      cy.clearCookies();
      cy.request({
        method: route.method,
        url: `/v1${route.path}`,
        body: route.body as Cypress.RequestBody,
        failOnStatusCode: false,
      })
        .its('status')
        .should('eq', 401);

      cy.signIn(SAM);
      const call = () =>
        route.method === 'GET'
          ? apiGet(route.path, { failOnStatusCode: false })
          : route.method === 'POST'
            ? apiPost(route.path, route.body, { failOnStatusCode: false })
            : route.method === 'PATCH'
              ? apiPatch(route.path, route.body, { failOnStatusCode: false })
              : apiDelete(route.path, { failOnStatusCode: false });
      call().its('status').should('eq', 403);

      cy.signIn(ADMIN);
      call().then((response) => {
        expect(response.status).to.be.oneOf([200, 201, 204, 404, 409]);
        // The three POSTs that succeed here create a real row; clean it up
        // so this table-driven pass leaves no trace on the shared stack.
        if (response.status === 201 && route.path === '/taxonomy/categories') {
          apiDelete(`/taxonomy/categories/${(response.body as { id: string }).id}`);
        }
        if (response.status === 201 && route.path === '/taxonomy/statuses') {
          apiDelete(`/taxonomy/statuses/${(response.body as { id: string }).id}`);
        }
        if (response.status === 201 && route.path === '/invitations') {
          apiDelete(`/invitations/${(response.body as { id: string }).id}`);
        }
      });
    });
  }

  it('status and pin changes are 401 anonymous, 403 non-admin, 200 admin', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.clearCookies();
      apiPatch(`/requests/${request.id}/status`, { statusId: request.statusId }, { failOnStatusCode: false })
        .its('status')
        .should('eq', 401);

      cy.signIn(SAM);
      apiPatch(`/requests/${request.id}/status`, { statusId: request.statusId }, { failOnStatusCode: false })
        .its('status')
        .should('eq', 403);
      apiPatch(`/requests/${request.id}/pin`, { pinned: true }, { failOnStatusCode: false }).its('status').should('eq', 403);

      cy.signIn(ADMIN);
      apiPatch(`/requests/${request.id}/status`, { statusId: request.statusId }, { failOnStatusCode: false })
        .its('status')
        .should('eq', 200);
      apiPatch(`/requests/${request.id}/pin`, { pinned: true }, { failOnStatusCode: false }).its('status').should('eq', 200);
    });
  });

  it('editing another\'s comment is 401 anonymous, 403 for anyone but the author (admin included)', () => {
    makeRequest({ as: SAM }).then((request) => {
      makeComment(request.id, { as: SAM }).then((comment) => {
        cy.clearCookies();
        apiPatch(`/comments/${comment.id}`, { body: 'x' }, { failOnStatusCode: false }).its('status').should('eq', 401);

        cy.signIn(ADMIN);
        apiPatch(`/comments/${comment.id}`, { body: 'x' }, { failOnStatusCode: false }).its('status').should('eq', 403);
      });
    });
  });
});
