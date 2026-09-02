import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { withTaxonomy } from '../../support/fixtures/taxonomy.fixture';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api, apiGet } from '../../support/clients/api.client';
import { stampedTitle } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';

describe('admin: categories', () => {
  withTaxonomy(() => {
    it('adds a category via the UI; it appears in the table and in the new-request form', () => {
      const name = stampedTitle('cat');
      cy.visitAs(ADMIN, '/admin/categories');
      cy.byTestId(TID.admin.taxAdd).click();
      cy.byTestId(TID.admin.taxDialog).within(() => {
        cy.get('#new-category').type(name);
        cy.byTestId(TID.admin.taxSubmit).click();
      });
      cy.contains(`[data-testid="${TID.admin.taxRow}"]`, name, { timeout: 10_000 }).should('exist');

      cy.visit('/requests/new');
      // The testid sits on the `<input>` itself, which has no visible text of
      // its own — the name is a sibling `<span>` under the same `<label>`, so
      // find the label by its text and assert the radio is inside it.
      cy.contains('label.category-option', name).find(`[data-testid="${TID.form.category}"]`).should('exist');
    });

    it('renames a category via the API and sees it reflected in the admin row', () => {
      cy.signIn(ADMIN);
      api.taxonomy.categories.create({ name: stampedTitle('rename-me'), color: '#112233' }).then((response) => {
        const category = response.body as { id: string; name: string };
        const renamed = stampedTitle('renamed');
        api.taxonomy.categories.update(category.id, { name: renamed }).its('status').should('eq', 200);
        cy.visit('/admin/categories');
        cy.contains(`[data-testid="${TID.admin.taxRow}"]`, renamed, { timeout: 10_000 }).should('exist');
      });
    });

    it('retiring then restoring a category round-trips through the UI', () => {
      cy.signIn(ADMIN);
      api.taxonomy.categories.create({ name: stampedTitle('retire-me'), color: '#445566' }).then((response) => {
        const category = response.body as { id: string; name: string };
        cy.visit('/admin/categories');
        cy.get(`[data-testid="${TID.admin.taxRow}"][data-taxonomy-id="${category.id}"]`).within(() => {
          cy.byTestId(TID.admin.taxRetire).click();
        });
        cy.byTestId(TID.state.confirmAccept).click();
        cy.get(`[data-taxonomy-id="${category.id}"]`, { timeout: 10_000 }).find(`[data-testid="${TID.admin.taxRestore}"]`).should('exist');
        cy.get(`[data-taxonomy-id="${category.id}"]`).find(`[data-testid="${TID.admin.taxRestore}"]`).click();
        cy.get(`[data-taxonomy-id="${category.id}"]`, { timeout: 10_000 }).find(`[data-testid="${TID.admin.taxRetire}"]`).should('exist');
      });
    });

    it('an active category with no requests offers Delete; deleting removes it', () => {
      cy.signIn(ADMIN);
      api.taxonomy.categories.create({ name: stampedTitle('delete-me'), color: '#778899' }).then((response) => {
        const category = response.body as { id: string };
        cy.visit('/admin/categories');
        cy.get(`[data-taxonomy-id="${category.id}"]`).find(`[data-testid="${TID.admin.taxDelete}"]`).click();
        cy.byTestId(TID.state.confirmAccept).click();
        cy.get(`[data-taxonomy-id="${category.id}"]`, { timeout: 10_000 }).should('not.exist');
      });
    });

    it('a category in use offers no Delete control, and DELETE returns 409', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(ADMIN);
        cy.visit('/admin/categories');
        cy.get(`[data-taxonomy-id="${request.categoryId}"]`).find(`[data-testid="${TID.admin.taxDelete}"]`).should('not.exist');
        api.taxonomy.categories.remove(request.categoryId).its('status').should('eq', 409);
      });
    });

    it('duplicate category names are rejected with 409', () => {
      cy.signIn(ADMIN);
      const name = stampedTitle('dup');
      api.taxonomy.categories.create({ name, color: '#000000' });
      api.taxonomy.categories.create({ name, color: '#000000' }).its('status').should('eq', 409);
    });

    it('retiring the last active category is refused with 409', () => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const active = taxonomy.categories.filter((c) => c.isActive);
        // Retire all but one.
        for (const category of active.slice(1)) {
          api.taxonomy.categories.retire(category.id);
        }
        const last = active[0]!;
        api.taxonomy.categories.retire(last.id).its('status').should('eq', 409);
        // Restore everything this test retired.
        for (const category of active.slice(1)) {
          api.taxonomy.categories.update(category.id, { isActive: true });
        }
      });
    });

    it('non-admin gets 403 on every category route', () => {
      cy.signIn(SAM);
      cy.visit('/admin/categories');
      cy.location('pathname', { timeout: 10_000 }).should('eq', '/not-allowed');
      apiGet('/taxonomy', { failOnStatusCode: false }).its('status').should('eq', 403);
      api.taxonomy.categories.create({ name: 'x', color: '#000000' }).its('status').should('eq', 403);
    });

    it('a non-UUID id is 400; an unknown UUID is 404', () => {
      cy.signIn(ADMIN);
      api.taxonomy.categories.update('not-a-uuid', { name: 'x' }).its('status').should('eq', 400);
      api.taxonomy.categories.update('00000000-0000-4000-8000-000000000000', { name: 'x' }).its('status').should('eq', 404);
    });
  });
});
