import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { api } from '../../support/clients/api.client';
import { mailpit } from '../../support/clients/mailpit.client';
import { stampedTitle } from '../../support/utils/stamp';

/** The three notification kinds
 *  (comment_on_my_request, status_changed_on_my_request, invitation), their
 *  opt-outs, and mail language following the server-side setting. Subject
 *  lines are exact, from apps/api .../notifications/application/render/messages.ts:
 *  `New comment on "<title>"`, `"<title>" has a new status`,
 *  `You have been invited to FeedbackHub` (Arabic: `تعليق جديد على "<title>"`,
 *  `تغيّرت حالة "<title>"`, `دعوة للانضمام إلى FeedbackHub`). */

/** Polls until a message with exactly `subject` has arrived for `address`. */
function expectSubject(address: string, subject: string): void {
  const deadline = Date.now() + 15_000;
  const attempt = (): void => {
    mailpit.search(`to:${address}`).then((messages) => {
      if (messages.some((m) => m.Subject === subject)) {
        return;
      }
      if (Date.now() > deadline) {
        throw new Error(`mailpit: never saw a message to ${address} with subject "${subject}"`);
      }
      cy.wait(500, { log: false }).then(attempt);
    });
  };
  attempt();
}

/** Asserts no message with exactly `subject` arrives for `address` within the
 *  settle window. */
function expectNoSubject(address: string, subject: string, settleMs = 3_000): void {
  cy.wait(settleMs, { log: false }).then(() =>
    mailpit.search(`to:${address}`).then((messages) => {
      expect(messages.some((m) => m.Subject === subject), `no mail with subject "${subject}" should exist`).to.eq(
        false,
      );
    }),
  );
}

describe('notification emails', () => {
  afterEach(() => {
    cy.signIn(SAM);
    api.settings.me.update({ notifyOnComment: true, notifyOnStatusChange: true, language: null });
  });

  it("Rae commenting on Sam's request sends Sam mail with the exact comment subject", () => {
    const title = stampedTitle('Mail-me request');
    makeRequest({ as: SAM, title }).then((request) => {
      cy.signIn(RAE);
      api.comments.write(request.id, 'a comment that should notify Sam');
      expectSubject(SAM.username, `New comment on "${title}"`);
    });
  });

  it('Sam commenting on his own request sends no self-notification', () => {
    const title = stampedTitle('No self notify');
    makeRequest({ as: SAM, title }).then((request) => {
      cy.signIn(SAM);
      api.comments.write(request.id, 'commenting on my own request');
      expectNoSubject(SAM.username, `New comment on "${title}"`);
    });
  });

  it('Sam with notifyOnComment off receives no mail', () => {
    const title = stampedTitle('Opted out of comment mail');
    cy.signIn(SAM);
    api.settings.me.update({ notifyOnComment: false });
    makeRequest({ as: SAM, title }).then((request) => {
      cy.signIn(RAE);
      api.comments.write(request.id, 'should not notify — opted out');
      expectNoSubject(SAM.username, `New comment on "${title}"`);
    });
  });

  it("admin changing the status of Sam's request sends the exact status-change subject", () => {
    const title = stampedTitle('Status mail request');
    makeRequest({ as: SAM, title }).then((request) => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const target = taxonomy.statuses.find((s) => s.id !== request.statusId && s.isActive)!;
        api.requests.setStatus(request.id, target.id).then(() => {
          expectSubject(SAM.username, `"${title}" has a new status`);
        });
      });
    });
  });

  it('Sam with notifyOnStatusChange off receives no status-change mail', () => {
    const title = stampedTitle('Opted out of status mail');
    cy.signIn(SAM);
    api.settings.me.update({ notifyOnStatusChange: false });
    makeRequest({ as: SAM, title }).then((request) => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const target = taxonomy.statuses.find((s) => s.id !== request.statusId && s.isActive)!;
        api.requests.setStatus(request.id, target.id);
      });
      expectNoSubject(SAM.username, `"${title}" has a new status`);
    });
  });

  it("Sam with server-side language 'ar' gets the Arabic status subject", () => {
    const title = stampedTitle('Arabic mail request');
    cy.signIn(SAM);
    api.settings.me.update({ language: 'ar' });
    makeRequest({ as: SAM, title }).then((request) => {
      cy.signIn(ADMIN);
      api.taxonomy.read().then((taxonomy) => {
        const target = taxonomy.statuses.find((s) => s.id !== request.statusId && s.isActive)!;
        api.requests.setStatus(request.id, target.id).then(() => {
          expectSubject(SAM.username, `تغيّرت حالة "${title}"`);
        });
      });
    });
  });

});

// Its own describe: `withAppSettings`'s before()/after() are scoped to
// whichever describe calls them and run before the FIRST / after the LAST
// test in it, regardless of declaration position — sharing the describe
// above would put every earlier test under moderation too.
describe('notification emails under comment moderation', () => {
  withAppSettings({ commentsRequireApproval: true }, () => {
    it('mail is sent at approve time only; a rejected comment sends none', () => {
      // Two separate requests, each with its own title/subject — an approved
      // and a rejected comment on the SAME request would share one subject
      // line, and the approve mail would make the "no mail" check on the
      // reject case a false negative.
      const approvedTitle = stampedTitle('Approve mail request');
      const rejectedTitle = stampedTitle('Reject mail request');

      makeRequest({ as: SAM, title: approvedTitle }).then((request) => {
        cy.signIn(RAE);
        api.comments.write(request.id, 'pending, then approved').then((comment) => {
          expectNoSubject(SAM.username, `New comment on "${approvedTitle}"`, 2_000);
          cy.signIn(ADMIN);
          api.comments.approve(comment.id).then(() => {
            expectSubject(SAM.username, `New comment on "${approvedTitle}"`);
          });
        });
      });

      makeRequest({ as: SAM, title: rejectedTitle }).then((request) => {
        cy.signIn(RAE);
        api.comments.write(request.id, 'pending, then rejected').then((comment) => {
          cy.signIn(ADMIN);
          api.comments.reject(comment.id);
          expectNoSubject(SAM.username, `New comment on "${rejectedTitle}"`, 3_000);
        });
      });
    });
  });
});
