import type { Account } from './accounts';

declare global {
  namespace Cypress {
    interface Chainable {
      signIn(account: Account): Chainable<void>;
      apiGet(path: string, failOnStatusCode?: boolean): Chainable<Cypress.Response<any>>;
      apiPost(path: string, body?: unknown, failOnStatusCode?: boolean): Chainable<Cypress.Response<any>>;
      apiPatch(path: string, body?: unknown, failOnStatusCode?: boolean): Chainable<Cypress.Response<any>>;
      apiDelete(path: string, failOnStatusCode?: boolean): Chainable<Cypress.Response<any>>;
      visitRequest(requestId: string): Chainable<void>;
      findAndOpenRequest(title: string): Chainable<void>;
    }
  }
}

const keycloakOrigin = () => String(Cypress.env('keycloakOrigin') ?? 'http://localhost:8080');
const appOrigin = () => String(Cypress.config('baseUrl') ?? 'http://localhost:4200');

Cypress.Commands.add('signIn', (account: Account) => {
  cy.session(
    ['feedbackhub', account.username],
    () => {
      // Inside a cy.session() setup there is never a valid cookie, so the app's
      // auth guard always bounces us to Keycloak. Drive that flow directly
      // rather than probing which origin we ended up on (which races the
      // asynchronous redirect the SPA fires after it has already painted).
      cy.visit('/');

      cy.origin(keycloakOrigin(), { args: { account } }, ({ account: credentials }) => {
        // Long timeout: this is where the 4200 -> API -> 8080 redirect chain and
        // the Keycloak page load are waited on.
        cy.get('input[name="username"], input#username, input[type="email"]', {
          timeout: 30_000,
        })
          .first()
          .should('be.visible')
          .clear()
          .type(credentials.username);
        cy.get('input[name="password"], input#password', { timeout: 20_000 })
          .should('be.visible')
          .clear()
          .type(credentials.password, { log: false });
        cy.contains('button, input[type="submit"]', /^Sign In$|^Log In$/i)
          .should('be.visible')
          .click();
      });

      cy.location('origin', { timeout: 30_000 }).should('eq', appOrigin());
      // The board is the landing screen and the only <h1> that says "Feedback".
      cy.contains('h1', /Feedback/i, { timeout: 20_000 }).should('be.visible');
    },
    {
      cacheAcrossSpecs: false,
      validate() {
        // `.then` + `expect`, never `.its().should()`: a retrying assertion here
        // tries to talk to the application window, which fails when a previous
        // test left it on the Keycloak origin.
        cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).then((response) => {
          expect(response.status).to.eq(200);
        });
      },
    },
  );
});

function api(path: string): string {
  return `/v1${path}`;
}

/**
 * Every write carries an `Origin` header from an allowed web address. The API's
 * OriginGuard (R-3g) refuses any POST/PUT/PATCH/DELETE whose Origin is missing
 * or unknown, and `cy.request()` sends no Origin of its own.
 */
const writeHeaders = () => ({ origin: appOrigin() });

Cypress.Commands.add('apiGet', (path, failOnStatusCode = true) =>
  cy.request({ method: 'GET', url: api(path), failOnStatusCode }),
);
Cypress.Commands.add('apiPost', (path, body, failOnStatusCode = true) =>
  cy.request({
    method: 'POST',
    url: api(path),
    body: body as Cypress.RequestBody,
    headers: writeHeaders(),
    failOnStatusCode,
  }),
);
Cypress.Commands.add('apiPatch', (path, body, failOnStatusCode = true) =>
  cy.request({
    method: 'PATCH',
    url: api(path),
    body: body as Cypress.RequestBody,
    headers: writeHeaders(),
    failOnStatusCode,
  }),
);
Cypress.Commands.add('apiDelete', (path, failOnStatusCode = true) =>
  cy.request({ method: 'DELETE', url: api(path), headers: writeHeaders(), failOnStatusCode }),
);

Cypress.Commands.add('visitRequest', (requestId: string) => {
  cy.visit(`/requests/${requestId}`);
  cy.contains('h1', /./, { timeout: 15_000 }).should('be.visible');
});

Cypress.Commands.add('findAndOpenRequest', (title: string) => {
  cy.visit('/');
  cy.get('input#board-search, input[placeholder*="Search" i]').first().as('search');
  cy.get('@search').clear().type(title);
  cy.location('search', { timeout: 10_000 }).should('contain', `search=${encodeURIComponent(title)}`);
  cy.contains('a', title, { timeout: 10_000 }).should('be.visible').click();
  cy.contains('h1', title, { timeout: 10_000 }).should('be.visible');
});
