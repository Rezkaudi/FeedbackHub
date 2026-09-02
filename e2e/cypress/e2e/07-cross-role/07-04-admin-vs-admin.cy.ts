import { ADMIN, ADMIN2, SAM } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { withTaxonomy } from '../../support/fixtures/taxonomy.fixture';
import { api } from '../../support/clients/api.client';
import { stampedEmail } from '../../support/utils/stamp';

/** One admin undoing or overriding another admin's change — only provable
 *  because a second admin (Bo) is now seeded alongside Ada. */
describe('admin vs admin', () => {
  it('Bo deletes a comment Ada approved/left on someone else\'s request', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.comments.write(request.id, "Ada's comment").then((comment) => {
        cy.signIn(ADMIN2);
        api.comments.remove(comment.id).its('status').should('eq', 204);
      });
    });
  });

  it('Bo overrides a status Ada set', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const first = taxonomy.statuses.find((s) => s.id !== request.statusId && s.isActive)!;
        api.requests.setStatus(request.id, first.id).then(() => {
          cy.signIn(ADMIN2);
          const second = taxonomy.statuses.find((s) => s.id !== first.id && s.isActive)!;
          api.requests.setStatus(request.id, second.id).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body.statusId).to.eq(second.id);
          });
        });
      });
    });
  });

  withTaxonomy(() => {
    it('Bo retires a category Ada created', () => {
      cy.signIn(ADMIN);
      api.taxonomy.categories.create({ name: `ada-made-this-${Date.now()}`, color: '#6a1b9a' }).then((response) => {
        const category = response.body as { id: string };
        cy.signIn(ADMIN2);
        api.taxonomy.categories.retire(category.id).its('status').should('eq', 201);
      });
    });
  });

  it("Bo withdraws an invitation Ada sent", () => {
    const email = stampedEmail('ada-invited');
    cy.signIn(ADMIN);
    api.invitations.create(email).then((response) => {
      const invitation = response.body as { id: string };
      cy.signIn(ADMIN2);
      api.invitations.remove(invitation.id).its('status').should('eq', 204);
    });
  });

  it("Bo un-pins a request Ada pinned", () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.setPinned(request.id, true).then(() => {
        cy.signIn(ADMIN2);
        api.requests.setPinned(request.id, false).its('status').should('eq', 200);
      });
    });
  });

  it('Bo edits a request Ada edited earlier (both admins, neither the author)', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.update(request.id, { title: 'Edited first by Ada' });
      cy.signIn(ADMIN2);
      api.requests.update(request.id, { title: 'Then edited by Bo' }).its('title').should('eq', 'Then edited by Bo');
    });
  });
});
