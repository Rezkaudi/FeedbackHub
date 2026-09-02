import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { withTaxonomy } from '../../support/fixtures/taxonomy.fixture';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { stampedTitle } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';

describe('admin: statuses', () => {
  withTaxonomy(() => {
    it('adds a status via the UI; it appears in the table', () => {
      const name = stampedTitle('status');
      cy.visitAs(ADMIN, '/admin/statuses');
      cy.byTestId(TID.admin.taxAdd).click();
      cy.byTestId(TID.admin.taxDialog).within(() => {
        cy.get('#new-status').type(name);
        cy.byTestId(TID.admin.taxSubmit).click();
      });
      cy.contains(`[data-testid="${TID.admin.taxRow}"]`, name, { timeout: 10_000 }).should('exist');
    });

    it('makes a status the default; the old default loses its marker', () => {
      cy.signIn(ADMIN);
      api.taxonomy.statuses.create({ name: stampedTitle('new-default'), color: '#123456' }).then((response) => {
        const status = response.body as { id: string };
        api.taxonomy.statuses.makeDefault(status.id).its('status').should('eq', 204);
        api.taxonomy.read().then((taxonomy) => {
          const defaults = taxonomy.statuses.filter((s) => s.isDefault);
          expect(defaults).to.have.length(1);
          expect(defaults[0]!.id).to.eq(status.id);
        });
      });
    });

    it('a new request lands on the current default status', () => {
      cy.signIn(ADMIN);
      api.taxonomy.statuses.create({ name: stampedTitle('temp-default'), color: '#654321' }).then((response) => {
        const status = response.body as { id: string };
        api.taxonomy.statuses.makeDefault(status.id).then(() => {
          makeRequest({ as: SAM }).then((request) => {
            expect(request.statusId).to.eq(status.id);
          });
        });
      });
    });

    it('the default status offers no retire control, and retiring it is 409', () => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const current = taxonomy.statuses.find((s) => s.isDefault)!;
        cy.visit('/admin/statuses');
        cy.get(`[data-taxonomy-id="${current.id}"]`).find(`[data-testid="${TID.admin.taxRetire}"]`).should('not.exist');
        api.taxonomy.statuses.retire(current.id).its('status').should('eq', 409);
      });
    });

    it('retiring a non-default status removes it from the menu, but old requests keep it', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(ADMIN);
        api.taxonomy.read().then((taxonomy) => {
          const nonDefault = taxonomy.statuses.find((s) => !s.isDefault && s.isActive)!;
          api.requests.setStatus(request.id, nonDefault.id).then(() => {
            api.taxonomy.statuses.retire(nonDefault.id);
            api.requests.read(request.id).its('statusId').should('eq', nonDefault.id);
            api.taxonomy.statuses.update(nonDefault.id, { isActive: true });
          });
        });
      });
    });

    it('making a retired status the default is refused with 409', () => {
      cy.signIn(ADMIN);
      api.taxonomy.statuses.create({ name: stampedTitle('retired-cant-default'), color: '#abcdef' }).then((response) => {
        const status = response.body as { id: string };
        api.taxonomy.statuses.retire(status.id);
        api.taxonomy.statuses.makeDefault(status.id).its('status').should('eq', 409);
      });
    });

    it('deletes an unused status via the UI', () => {
      cy.signIn(ADMIN);
      api.taxonomy.statuses.create({ name: stampedTitle('delete-me-status'), color: '#0f0f0f' }).then((response) => {
        const status = response.body as { id: string };
        cy.visit('/admin/statuses');
        cy.get(`[data-taxonomy-id="${status.id}"]`).find(`[data-testid="${TID.admin.taxDelete}"]`).click();
        cy.byTestId(TID.state.confirmAccept).click();
        cy.get(`[data-taxonomy-id="${status.id}"]`, { timeout: 10_000 }).should('not.exist');
      });
    });

    it('a status in use is refused deletion with 409', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(ADMIN);
        api.taxonomy.statuses.remove(request.statusId).its('status').should('eq', 409);
      });
    });

    it('non-admin gets 403 on every status route', () => {
      cy.signIn(SAM);
      cy.visit('/admin/statuses');
      cy.location('pathname', { timeout: 10_000 }).should('eq', '/not-allowed');
      api.taxonomy.statuses.create({ name: 'x', color: '#000000' }).its('status').should('eq', 403);
    });
  });
});
