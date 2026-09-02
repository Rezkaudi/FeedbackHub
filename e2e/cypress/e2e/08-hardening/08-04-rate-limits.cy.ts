import { ADMIN, SAM, RAE } from '../../support/fixtures/accounts';
import { withAppSettings } from '../../support/fixtures/app-settings.fixture';
import { makeRequest } from '../../support/fixtures/entities.fixture';
import { api } from '../../support/clients/api.client';
import { stampedTitle } from '../../support/utils/stamp';
import type { ApiErrorBody } from '../../support/utils/types';

// Each rate limit gets its own top-level describe — see the note in
// 01-04-sign-up-refused.cy.ts on why `withAppSettings` calls must not share a
// describe with tests that did not ask for that configuration.

describe('the submission rate limit', () => {
  withAppSettings({ submissionLimitCount: 2, submissionLimitMinutes: 1 }, () => {
    it('the third submission in the window is 429 with a future retryAt', () => {
      cy.signIn(SAM);
      api.bootstrap().then((boot) => {
        const categoryId = boot.categories.find((c) => c.isActive)!.id;
        const create = () => api.requests.createRaw({ title: stampedTitle('rate-limit'), description: 'x'.repeat(20), categoryId });
        create().then((r1) => {
          expect(r1.status).to.eq(201);
          create().then((r2) => {
            expect(r2.status).to.eq(201);
            create().then((r3) => {
              expect(r3.status).to.eq(429);
              const body = r3.body as unknown as ApiErrorBody;
              expect(body.error.code).to.eq('SUBMISSION_RATE_LIMITED');
              expect(new Date(body.error.retryAt!).getTime()).to.be.greaterThan(Date.now());
              api.requests.remove((r1.body as { id: string }).id);
              api.requests.remove((r2.body as { id: string }).id);
            });
          });
        });
      });
    });

    it('the limit is per author: a different persona is unaffected', () => {
      cy.signIn(SAM);
      api.bootstrap().then((boot) => {
        const categoryId = boot.categories.find((c) => c.isActive)!.id;
        api.requests.createRaw({ title: stampedTitle('sam-a'), description: 'x'.repeat(20), categoryId });
        api.requests.createRaw({ title: stampedTitle('sam-b'), description: 'x'.repeat(20), categoryId });
        api.requests.createRaw({ title: stampedTitle('sam-c'), description: 'x'.repeat(20), categoryId }).its('status').should('eq', 429);
      });
      cy.signIn(RAE);
      api.bootstrap().then((boot) => {
        const categoryId = boot.categories.find((c) => c.isActive)!.id;
        api.requests.create({ title: stampedTitle('rae-unaffected'), description: 'x'.repeat(20), categoryId }).then((r) => {
          api.requests.remove(r.id);
        });
      });
    });
  });
});

describe('the vote rate limit', () => {
  withAppSettings({ voteLimitCount: 3, voteLimitMinutes: 1 }, () => {
    it('a fourth distinct vote in the window is 429', () => {
      // The limiter counts vote *rows that currently exist* in the window
      // (see the doc comment on `countVotesBy` in
      // prisma-vote.repository.ts) — it does not have a separate log of
      // attempts. So four votes on four different requests is what actually
      // exhausts it.
      makeRequest({ as: SAM }).then((r1) => {
        makeRequest({ as: SAM }).then((r2) => {
          makeRequest({ as: SAM }).then((r3) => {
            makeRequest({ as: SAM }).then((r4) => {
              cy.signIn(RAE);
              api.requests.vote(r1.id).its('status').should('eq', 201);
              api.requests.vote(r2.id).its('status').should('eq', 201);
              api.requests.vote(r3.id).its('status').should('eq', 201);
              api.requests.vote(r4.id).its('status').should('eq', 429);
            });
          });
        });
      });
    });

    it('documents the known gap: a vote/un-vote pair on the SAME request never counts against the limit', () => {
      // Withdrawing deletes the row, so a vote immediately followed by an
      // un-vote leaves nothing in the window to count — a person can toggle
      // one request's vote as many times as they like without ever being
      // limited. This is a real, accepted product gap (see SCOPE.md), not a
      // test bug: it is proven here, not asserted away.
      makeRequest({ as: SAM }).then((request) => {
        cy.signIn(RAE);
        for (let i = 0; i < 5; i += 1) {
          api.requests.vote(request.id).its('status').should('eq', 201);
          api.requests.unvote(request.id).its('status').should('eq', 200);
        }
      });
    });
  });
});

describe('reads are unaffected by rate limits', () => {
  withAppSettings({ signupLimitCount: 1, signupLimitMinutes: 1 }, () => {
    it('reads are never rate-limited, regardless of the signup limit', () => {
      cy.signIn(ADMIN);
      api.requests.list().its('total').should('be.a', 'number');
    });
  });
});

describe('a limit change takes effect live', () => {
  it('raising the submission limit takes effect without a restart', () => {
    cy.signIn(ADMIN);
    api.settings.app.update({ submissionLimitCount: 1, submissionLimitMinutes: 1 }).then(() => {
      cy.signIn(SAM);
      api.bootstrap().then((boot) => {
        const categoryId = boot.categories.find((c) => c.isActive)!.id;
        api.requests.createRaw({ title: stampedTitle('raise-a'), description: 'x'.repeat(20), categoryId }).then((r1) => {
          api.requests.createRaw({ title: stampedTitle('raise-b'), description: 'x'.repeat(20), categoryId }).its('status').should('eq', 429);
          cy.signIn(ADMIN);
          api.settings.app.update({ submissionLimitCount: 100_000 }).then(() => {
            cy.signIn(SAM);
            api.requests.create({ title: stampedTitle('raise-c'), description: 'x'.repeat(20), categoryId }).then((r3) => {
              api.requests.remove(r3.id);
            });
          });
          api.requests.remove((r1.body as { id: string }).id);
        });
      });
    });
  });
});
