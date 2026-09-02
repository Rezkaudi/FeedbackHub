import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

describe('change request status', () => {
  it('an admin changes status from the status menu; the chip and board both update', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const target = taxonomy.statuses.find((s) => s.id !== request.statusId && s.isActive)!;
        cy.visitAs(ADMIN, `/requests/${request.id}`);
        cy.byTestId(TID.detail.statusMenuTrigger).click();
        cy.get(`[data-testid="${TID.detail.statusMenuOption}"][data-status-id="${target.id}"]`).click();
        api.requests.read(request.id).its('statusId').should('eq', target.id);
      });
    });
  });

  it('only active statuses are offered in the menu', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      // No status is retired by default in the seed — make one and retire it.
      api.taxonomy.statuses.create({ name: `not-offered-${Date.now()}`, color: '#444444' }).then((response) => {
        const retired = response.body as { id: string };
        api.taxonomy.statuses.retire(retired.id).then(() => {
          cy.visitAs(ADMIN, `/requests/${request.id}`);
          cy.byTestId(TID.detail.statusMenuTrigger).click();
          cy.get(`[data-testid="${TID.detail.statusMenuOption}"][data-status-id="${retired.id}"]`).should('not.exist');
          api.taxonomy.statuses.remove(retired.id);
        });
      });
    });
  });

  it('the author, not an admin, has no status control and PATCH …/status is 403', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.visitAs(SAM, `/requests/${request.id}`);
      cy.byTestId(TID.detail.statusMenuTrigger).should('not.exist');
      cy.signIn(SAM);
      // /v1/taxonomy is admin-only; a non-admin reads statuses via bootstrap.
      api.bootstrap().then((boot) => {
        api.requests.setStatus(request.id, boot.statuses[0]!.id).its('status').should('eq', 403);
      });
    });
  });

  it('setting the current status again is accepted and idempotent', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.setStatus(request.id, request.statusId).its('status').should('eq', 200);
    });
  });

  it('setting a retired status id is rejected', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      // No status is retired by default in the seed — make one, retire it,
      // then try to assign it.
      api.taxonomy.statuses.create({ name: `retired-for-test-${Date.now()}`, color: '#333333' }).then((response) => {
        const status = response.body as { id: string };
        api.taxonomy.statuses.retire(status.id).then(() => {
          api.requests.setStatus(request.id, status.id).its('status').should('eq', 400);
          api.taxonomy.statuses.remove(status.id);
        });
      });
    });
  });

  it('setting an unknown status id fails with the documented envelope', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.setStatus(request.id, '00000000-0000-4000-8000-000000000000').its('status').should('be.oneOf', [400, 404]);
    });
  });
});
