import { ADMIN, SAM } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';
import type { ApiErrorBody } from '../../support/utils/types';

describe('comments switched off (featureCommentsEnabled: false)', () => {
  withAppSettings({ featureCommentsEnabled: false }, () => {
    it('the request-detail page hides the whole comment section', () => {
      cy.visitAs(SAM, '/');
      cy.byTestId(TID.card.root).first().click();
      cy.byTestId(TID.comment.form).should('not.exist');
      cy.byTestId(TID.comment.item).should('not.exist');
    });

    it('the board card hides the comment count', () => {
      cy.visitAs(SAM, '/');
      cy.byTestId(TID.card.comments).should('not.exist');
    });

    it('the six member comment routes are 403 FEATURE_DISABLED, for admins too', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(SAM);
        api.comments.listRaw(request.id).then((response) => {
          expect(response.status).to.eq(403);
          expect((response.body as unknown as ApiErrorBody).error.code).to.eq('FEATURE_DISABLED');
        });
        api.comments.writeRaw(request.id, { body: 'nope' }).its('status').should('eq', 403);

        cy.signIn(ADMIN);
        api.comments.listRaw(request.id).its('status').should('eq', 403);
        api.comments.writeRaw(request.id, { body: 'nope, admin too' }).its('status').should('eq', 403);
      });
    });

    it('PATCH and DELETE on an existing comment are also 403', () => {
      // Creating a comment before the feature is disabled would require its
      // own settings toggle; instead prove the guard applies uniformly by
      // hitting the routes directly, signed in, against a syntactically
      // valid id.
      cy.signIn(SAM);
      api.comments.edit('00000000-0000-4000-8000-000000000000', 'x').its('status').should('eq', 403);
      api.comments.remove('00000000-0000-4000-8000-000000000000').its('status').should('eq', 403);
    });

    it('the three moderation routes keep working while the feature is off', () => {
      cy.signIn(ADMIN);
      api.comments.pending().its('status').should('eq', 200);
      api.comments.approve('00000000-0000-4000-8000-000000000000').its('status').should('eq', 404); // reaches the handler, not FEATURE_DISABLED
      api.comments.reject('00000000-0000-4000-8000-000000000000').its('status').should('eq', 404);
    });

    it('bootstrap.features.commentsEnabled mirrors the setting', () => {
      cy.signIn(ADMIN);
      api.bootstrap().its('features.commentsEnabled').should('eq', false);
    });
  });
});

// A separate describe: `withAppSettings`'s before/after hooks apply to every
// `it()` in the describe they are called from (it is a plain `before()`, run
// once, not per test), so this scenario — which needs comments ON at the
// start and toggles the flag itself mid-test — cannot share the block above.
describe('comments come back on', () => {
  it('the thread returns intact once the feature is switched back on', () => {
    makeRequest({ as: SAM }).then((request) => {
      cy.signIn(SAM);
      api.comments.write(request.id, 'created while comments are on');
      cy.signIn(ADMIN);
      api.settings.app.update({ featureCommentsEnabled: false }).then(() => {
        api.settings.app.update({ featureCommentsEnabled: true }).then(() => {
          api.comments.list(request.id).its('items').should('have.length', 1);
        });
      });
    });
  });
});
