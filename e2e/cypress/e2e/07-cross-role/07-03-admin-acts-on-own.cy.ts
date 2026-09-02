import { ADMIN } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { withTaxonomy } from '../../support/fixtures/taxonomy.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

/** The "same admin" edge cases: an admin is still an admin when acting on
 *  their own content, and every admin-only action is still allowed. */
describe('an admin acting on their own content', () => {
  it('changes the status of their own request', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const target = taxonomy.statuses.find((s) => s.id !== request.statusId && s.isActive)!;
        api.requests.setStatus(request.id, target.id).its('status').should('eq', 200);
      });
    });
  });

  it('pins their own request', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.setPinned(request.id, true).its('status').should('eq', 200);
    });
  });

  it('votes on their own request', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.vote(request.id).its('status').should('eq', 201);
    });
  });

  it('writes a comment and deletes it via the admin path', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      cy.signIn(ADMIN);
      api.comments.write(request.id, 'admin commenting on their own request').then((comment) => {
        api.comments.remove(comment.id).its('status').should('eq', 204);
      });
    });
  });

  it('deletes their own request that carries another person\'s comment', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      cy.signIn(ADMIN);
      api.comments.write(request.id, 'admin\'s own comment on their own request');
      api.requests.remove(request.id).its('status').should('eq', 204);
    });
  });

  it('edits their own comment (the author path, not an admin bypass)', () => {
    makeRequest({ as: ADMIN }).then((request) => {
      cy.signIn(ADMIN);
      api.comments.write(request.id, 'original').then((comment) => {
        api.comments.edit(comment.id, 'edited by its own author, who happens to be an admin').its('status').should('eq', 200);
      });
    });
  });

  withTaxonomy(() => {
    it('retires the category their own request uses; the request still renders', () => {
      cy.signIn(ADMIN);
      api.taxonomy.categories.create({ name: `admin-own-category-${Date.now()}`, color: '#1565c0' }).then((response) => {
        const category = response.body as { id: string };
        makeRequest({ as: ADMIN, categoryId: category.id }).then((request) => {
          api.taxonomy.categories.retire(category.id);
          api.requests.read(request.id).its('categoryId').should('eq', category.id);
        });
      });
    });
  });
});
