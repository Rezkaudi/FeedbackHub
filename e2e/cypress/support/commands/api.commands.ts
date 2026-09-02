import { apiGet, apiPost, apiPatch, apiDelete, type ApiOptions } from '../clients/api.client';

declare global {
  namespace Cypress {
    interface Chainable {
      /** Raw `/v1`-prefixed request helpers, kept for specs that want the
       *  full `Cypress.Response` rather than the typed `api.*` surface in
       *  `clients/api.client.ts`. Writes carry an `Origin` header by default. */
      apiGet<T = unknown>(path: string, options?: ApiOptions): Chainable<Cypress.Response<T>>;
      apiPost<T = unknown>(path: string, body?: unknown, options?: ApiOptions): Chainable<Cypress.Response<T>>;
      apiPatch<T = unknown>(path: string, body?: unknown, options?: ApiOptions): Chainable<Cypress.Response<T>>;
      apiDelete<T = unknown>(path: string, options?: ApiOptions): Chainable<Cypress.Response<T>>;
    }
  }
}

Cypress.Commands.add('apiGet', (path, options) => apiGet(path, options));
Cypress.Commands.add('apiPost', (path, body, options) => apiPost(path, body, options));
Cypress.Commands.add('apiPatch', (path, body, options) => apiPatch(path, body, options));
Cypress.Commands.add('apiDelete', (path, options) => apiDelete(path, options));

export {};
