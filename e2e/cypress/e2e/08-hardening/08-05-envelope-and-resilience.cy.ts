import { ADMIN } from '../../support/fixtures/accounts';
import { api, apiPost } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';
import type { ApiErrorBody } from '../../support/utils/types';

describe('error envelope and resilience', () => {
  it('every error carries {error:{code,message,requestId}}, and requestId is unique per call', () => {
    apiPost('/requests', {}, { failOnStatusCode: false }).then((r1) => {
      apiPost('/requests', {}, { failOnStatusCode: false }).then((r2) => {
        const b1 = r1.body as unknown as ApiErrorBody;
        const b2 = r2.body as unknown as ApiErrorBody;
        expect(b1.error).to.include.keys('code', 'message', 'requestId');
        expect(b1.error.requestId).to.not.eq(b2.error.requestId);
      });
    });
  });

  it('retryAt appears only on 429; fields only on VALIDATION_FAILED', () => {
    cy.signIn(ADMIN);
    apiPost('/requests', {}, { failOnStatusCode: false }).then((response) => {
      const body = response.body as unknown as ApiErrorBody;
      expect(body.error.code).to.eq('VALIDATION_FAILED');
      expect(body.error.fields).to.exist;
      expect(body.error.retryAt).to.be.undefined;
    });
  });

  it('an intercepted 500 on bootstrap shows a failure screen, not a blank page', () => {
    cy.intercept('GET', '/v1/bootstrap', {
      statusCode: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'boom', requestId: 'req_boot_test' } },
    });
    cy.visitAs(ADMIN, '/');
    cy.get('h1', { timeout: 15_000 }).should('be.visible');
    cy.contains('req_boot_test').should('be.visible');
  });

  it('a network failure on bootstrap shows a retryable message with a working retry', () => {
    cy.intercept('GET', '/v1/bootstrap', { forceNetworkError: true }).as('failedBoot');
    cy.visitAs(ADMIN, '/');
    cy.wait('@failedBoot');
    cy.get('button', { timeout: 15_000 }).contains(/./).should('exist');
    cy.intercept('GET', '/v1/bootstrap', (req) => req.continue()).as('okBoot');
    cy.get('button').first().click();
    cy.wait('@okBoot');
    cy.byTestId(TID.header.userMenuTrigger, { timeout: 10_000 }).should('be.visible');
  });

  it('double-submitting the create-request form does not create two requests', () => {
    cy.visitAs(ADMIN, '/requests/new');
    const title = `double-submit-${Date.now()}`;
    cy.byTestId(TID.form.title).type(title);
    cy.byTestId(TID.form.description).type('A description of reasonable length for a double-submit test.');
    cy.get(`[data-testid="${TID.form.category}"]`).first().click({ force: true });
    cy.byTestId(TID.form.submit).click();
    cy.byTestId(TID.form.submit).click({ force: true }); // second click while the first is in flight, if still present
    cy.location('pathname', { timeout: 15_000 }).should('match', /^\/requests\/[0-9a-f-]{36}$/);
    api.requests.list({ search: title }).then((page) => {
      expect(page.items).to.have.length(1);
      api.requests.remove(page.items[0]!.id);
    });
  });
});
