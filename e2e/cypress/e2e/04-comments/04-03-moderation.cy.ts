import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

describe('comment moderation (commentsRequireApproval)', () => {
  withAppSettings({ commentsRequireApproval: true }, () => {
    it('a new comment is pending, and its author sees it with the waiting badge', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.visitAs(RAE, `/requests/${request.id}`);
        cy.byTestId(TID.comment.body).type('a comment waiting for approval');
        cy.byTestId(TID.comment.submit).click();
        cy.byTestId(TID.comment.pending, { timeout: 10_000 }).should('be.visible');
      });
    });

    it('a different member does not see the pending comment', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(RAE);
        api.comments.write(request.id, 'invisible to others until approved');
        cy.visitAs(SAM, `/requests/${request.id}`);
        cy.byTestId(TID.comment.item).should('not.exist');
      });
    });

    it('the admin sees it in the moderation queue, approves it, and it becomes visible to everyone', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(RAE);
        api.comments.write(request.id, 'to be approved').then((comment) => {
          cy.visitAs(ADMIN, '/admin/comments');
          cy.get(`[data-testid="${TID.admin.pendingCard}"][data-comment-id="${comment.id}"]`, { timeout: 10_000 })
            .find(`[data-testid="${TID.admin.pendingApprove}"]`)
            .click();
          // Approve goes through the shared confirm dialog first.
          cy.byTestId(TID.state.confirmAccept).click();
          cy.get(`[data-comment-id="${comment.id}"]`, { timeout: 10_000 }).should('not.exist');

          cy.visitAs(SAM, `/requests/${request.id}`);
          cy.byTestId(TID.comment.item).should('have.length', 1);
        });
      });
    });

    it('rejecting deletes it for good', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(RAE);
        api.comments.write(request.id, 'to be rejected').then((comment) => {
          cy.signIn(ADMIN);
          api.comments.reject(comment.id).its('status').should('eq', 204);
          api.comments.listRaw(request.id).then((response) => {
            expect(response.body.items.map((c: { id: string }) => c.id)).to.not.include(comment.id);
          });
        });
      });
    });

    it('the pending queue is empty when nothing is waiting', () => {
      cy.signIn(ADMIN);
      api.comments.pending().then((response) => {
        if (response.body.length === 0) {
          cy.visitAs(ADMIN, '/admin/comments');
          cy.byTestId(TID.state.emptyPanel).should('be.visible');
        }
      });
    });

    it('approve/reject on a non-UUID is 400; an unknown UUID is 404', () => {
      cy.signIn(ADMIN);
      api.comments.approve('not-a-uuid').its('status').should('eq', 400);
      api.comments.approve('00000000-0000-4000-8000-000000000000').its('status').should('eq', 404);
      api.comments.reject('not-a-uuid').its('status').should('eq', 400);
    });

    it('an admin\'s own comment on their own request never waits', () => {
      makeRequest({ as: ADMIN }).then((request) => {
        api.comments.write(request.id, 'admin comment, should publish immediately').then((comment) => {
          expect(comment.state).to.eq('published');
        });
      });
    });

    it('turning approval off afterwards leaves already-published comments published', () => {
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(SAM);
        api.comments.write(request.id, 'published before the flag changes').then((comment) => {
          cy.signIn(ADMIN);
          api.settings.app.update({ commentsRequireApproval: false }).then(() => {
            api.comments.list(request.id).then((page) => {
              expect(page.items.map((c) => c.id)).to.include(comment.id);
            });
            api.settings.app.update({ commentsRequireApproval: true });
          });
        });
      });
    });
  });
});
