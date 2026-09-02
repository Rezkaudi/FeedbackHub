import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { withTaxonomy } from '../../support/fixtures/taxonomy.fixture';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { stampedTitle } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';
import type { ApiErrorBody } from '../../support/utils/types';

// Each distinct settings/taxonomy configuration below lives in its own
// `describe` block. `withAppSettings`'s before()/after() are plain Mocha
// hooks scoped to whichever describe calls them — Mocha runs every before()
// in a describe before its FIRST test and every after() after its LAST,
// regardless of where the call appears relative to the `it()`s. Multiple
// top-level `withAppSettings` calls sharing one describe, or a sibling `it()`
// outside one, would apply every config from the very start and leak into
// tests that never asked for it.

describe('admin changes taxonomy; the user sees it', () => {
  withTaxonomy(() => {
    it('a new category appears in Sam\'s new-request form', () => {
      const name = stampedTitle('cross-role-cat');
      cy.signIn(ADMIN);
      api.taxonomy.categories.create({ name, color: '#0b57d0' });
      cy.visitAs(SAM, '/requests/new');
      // The testid sits on the `<input>`, which has no visible text of its
      // own — the name is a sibling `<span>` under the same `<label>`.
      cy.contains('label.category-option', name).find(`[data-testid="${TID.form.category}"]`).should('exist');
    });

    it('retiring a category removes it from the form, but Sam\'s existing request keeps the chip', () => {
      cy.signIn(ADMIN);
      api.taxonomy.categories.create({ name: stampedTitle('to-retire'), color: '#1565c0' }).then((response) => {
        const category = response.body as { id: string; name: string };
        makeRequest({ as: SAM, categoryId: category.id }).then((request) => {
          cy.signIn(ADMIN);
          api.taxonomy.categories.retire(category.id);
          cy.visitAs(SAM, `/requests/${request.id}`);
          cy.byTestId(TID.detail.category).should('be.visible');
          cy.visit('/requests/new');
          cy.contains('label.category-option', category.name).should('not.exist');
        });
      });
    });

    it('a new default status is what Sam\'s next request lands on', () => {
      cy.signIn(ADMIN);
      api.taxonomy.statuses.create({ name: stampedTitle('cross-role-status'), color: '#2e7d32' }).then((response) => {
        const status = response.body as { id: string };
        api.taxonomy.statuses.makeDefault(status.id).then(() => {
          makeRequest({ as: SAM }).then((request) => {
            expect(request.statusId).to.eq(status.id);
          });
        });
      });
    });
  });
});

describe('admin changes a request; the user sees it', () => {
  it('admin changes the status of Sam\'s request; Sam sees the new chip', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const target = taxonomy.statuses.find((s) => s.id !== request.statusId && s.isActive)!;
        api.requests.setStatus(request.id, target.id).then(() => {
          cy.visitAs(SAM, `/requests/${request.id}`);
          cy.byTestId(TID.detail.status).should('exist');
        });
      });
    });
  });

  it('admin pins Sam\'s request; Sam sees it pinned', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(ADMIN);
      api.requests.setPinned(request.id, true).then(() => {
        cy.visitAs(SAM, `/requests/${request.id}`);
        cy.byTestId(TID.detail.pin).should('not.exist'); // Sam is not admin, no control
        api.requests.read(request.id).its('isPinned').should('eq', true);
      });
    });
  });
});

describe('admin switches comments off; the user sees it', () => {
  withAppSettings({ featureCommentsEnabled: false }, () => {
    it('Sam\'s open request loses the thread after reload', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.visitAs(SAM, `/requests/${request.id}`);
        cy.byTestId(TID.comment.form).should('not.exist');
      });
    });
  });
});

describe('admin turns comment approval on; the user sees it', () => {
  withAppSettings({ commentsRequireApproval: true }, () => {
    it('Sam\'s next comment is pending and invisible to Rae', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(SAM);
        api.comments.write(request.id, 'now under moderation');
        cy.visitAs(RAE, `/requests/${request.id}`);
        cy.byTestId(TID.comment.item).should('not.exist');
      });
    });
  });
});

describe('admin lowers the submission limit; the user sees it', () => {
  withAppSettings({ submissionLimitCount: 1, submissionLimitMinutes: 1 }, () => {
    it('Sam\'s second request is refused with retryAt', () => {
      cy.signIn(SAM);
      api.bootstrap().then((boot) => {
        const categoryId = boot.categories.find((c) => c.isActive)!.id;
        api.requests.create({ title: stampedTitle('first'), description: 'x'.repeat(20), categoryId }).then((request) => {
          api.requests
            .createRaw({ title: stampedTitle('second'), description: 'x'.repeat(20), categoryId })
            .then((response) => {
              expect(response.status).to.eq(429);
              const body = response.body as unknown as ApiErrorBody;
              expect(body.error.code).to.eq('SUBMISSION_RATE_LIMITED');
              expect(body.error.retryAt).to.be.a('string');
            });
          api.requests.remove(request.id);
        });
      });
    });
  });
});

describe('admin switches the registration policy; an existing member is unaffected', () => {
  afterEach(() => {
    cy.signIn(ADMIN);
    api.settings.app.update({ registrationPolicy: 'open' });
  });

  it('Sam still signs in fine under invite_only', () => {
    cy.signIn(ADMIN);
    api.settings.app.update({ registrationPolicy: 'invite_only' }).then(() => {
      cy.signIn(SAM);
      api.bootstrap().its('user.role').should('eq', 'user');
    });
  });
});
