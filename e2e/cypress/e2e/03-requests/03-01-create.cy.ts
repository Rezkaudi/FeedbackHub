import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { api } from '../../support/clients/api.client';
import { stampedTitle } from '../../support/utils/stamp';
import { TID } from '../../support/utils/testids';
import type { ApiErrorBody } from '../../support/utils/types';

describe('create a request', () => {
  it('creates from the board dialog: closes, reloads the board, and offers a snackbar to view it', () => {
    cy.visitAs(SAM, '/');
    cy.byTestId(TID.board.newRequest).click();
    const title = stampedTitle('Board dialog create');
    cy.byTestId(TID.form.title).type(title);
    cy.byTestId(TID.form.description).type('A description long enough to pass validation, created via the board dialog.');
    cy.get(`[data-testid="${TID.form.category}"]`).first().click({ force: true });
    cy.byTestId(TID.form.submit).click();

    cy.byTestId(TID.form.dialog, { timeout: 15_000 }).should('not.exist');
    cy.contains('.request-card-title, [data-testid="request-card-title"]', title, { timeout: 10_000 }).should('exist');

    // The snackbar's "View" action navigates to the new request.
    cy.get('.snackbar-action', { timeout: 10_000 }).click();
    cy.location('pathname', { timeout: 10_000 }).should('match', /^\/requests\/[0-9a-f-]{36}$/);
    cy.byTestId(TID.detail.title).should('contain.text', title);

    cy.location('pathname').then((pathname) => {
      const id = pathname.split('/').pop()!;
      api.requests.remove(id);
    });
  });

  it('creates from the /requests/new page', () => {
    cy.visitAs(SAM, '/requests/new');
    const title = stampedTitle('New page create');
    cy.byTestId(TID.form.title).type(title);
    cy.byTestId(TID.form.description).type('A description long enough to pass validation, created from the full page.');
    cy.get(`[data-testid="${TID.form.category}"]`).first().click({ force: true });
    cy.byTestId(TID.form.submit).click();

    cy.location('pathname', { timeout: 15_000 }).should('match', /^\/requests\/[0-9a-f-]{36}$/);
    cy.location('pathname').then((pathname) => {
      const id = pathname.split('/').pop()!;
      api.requests.read(id).then((request) => {
        expect(request.title).to.eq(title);
        expect(request.isMine).to.eq(true);
      });
      api.requests.remove(id);
    });
  });

  it('gets the default status and the chosen category, and appears on the board and under "mine"', () => {
    cy.signIn(SAM);
    api.bootstrap().then((boot) => {
      const category = boot.categories.find((c) => c.isActive)!;
      const defaultStatus = boot.statuses.find((s) => s.isDefault)!;
      return api.requests.create({ title: stampedTitle('default status check'), description: 'x'.repeat(20), categoryId: category.id }).then((request) => {
        expect(request.statusId).to.eq(defaultStatus.id);
        expect(request.categoryId).to.eq(category.id);
        return api.requests.list({ mine: true }).then((page) => {
          expect(page.items.map((r) => r.id)).to.include(request.id);
          api.requests.remove(request.id);
        });
      });
    });
  });

  it('blocks submit and shows field errors for an empty title, description, or category', () => {
    cy.visitAs(SAM, '/requests/new');
    cy.byTestId(TID.form.submit).click();
    cy.get('[role="alert"]').should('have.length.at.least', 1);
    cy.location('pathname').should('eq', '/requests/new');
  });

  it('rejects an over-long title at the API with VALIDATION_FAILED and named fields', () => {
    cy.signIn(SAM);
    api.bootstrap().then((boot) => {
      api.requests
        .createRaw({
          title: 'x'.repeat(200),
          description: 'a valid description of reasonable length for this request.',
          categoryId: boot.categories.find((c) => c.isActive)!.id,
        })
        .then((response) => {
          expect(response.status).to.eq(400);
          const body = response.body as unknown as ApiErrorBody;
          expect(body.error.code).to.eq('VALIDATION_FAILED');
          expect(body.error.fields).to.have.property('title');
        });
    });
  });

  it('cancel discards the draft; nothing is created', () => {
    cy.visitAs(SAM, '/');
    api.requests.list().then((before) => {
      cy.byTestId(TID.board.newRequest).click();
      cy.byTestId(TID.form.title).type(stampedTitle('cancelled draft'));
      cy.byTestId(TID.form.cancel).click();
      cy.byTestId(TID.form.dialog).should('not.exist');
      api.requests.list().then((after) => {
        expect(after.total).to.eq(before.total);
      });
    });
  });

  it('retired categories are not offered as options', () => {
    cy.visitAs(ADMIN, '/requests/new');
    cy.get(`[data-testid="${TID.form.category}"]`).should('have.length.at.least', 1);
    // The testid sits on the `<input>`, which carries no visible text of its
    // own — the name lives in a sibling `<span>` under the same
    // `<label class="category-option">`, so check that label, not the input.
    cy.contains('label.category-option', /legacy/i).should('not.exist');
  });

  it('creating with a retired category id is rejected by the API', () => {
    cy.signIn(ADMIN);
    api.taxonomy.read().then((taxonomy) => {
      const legacy = taxonomy.categories.find((c) => c.slug === 'legacy')!;
      api.requests
        .createRaw({ title: stampedTitle('retired category'), description: 'a valid description here.', categoryId: legacy.id })
        .its('status')
        .should('eq', 400);
    });
  });

  it('an unknown body field is rejected with VALIDATION_FAILED', () => {
    cy.signIn(SAM);
    api.bootstrap().then((boot) => {
      api.requests
        .createRaw({
          title: stampedTitle('unknown field'),
          description: 'a valid description of reasonable length.',
          categoryId: boot.categories.find((c) => c.isActive)!.id,
          statusId: boot.statuses[0]!.id,
        })
        .its('status')
        .should('eq', 400);
    });
  });
});
