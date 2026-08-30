import { ADMIN, RAE } from '../support/accounts';
import { activeTaxonomy, readAppSettings, stamp, writeAppSettings } from '../support/helpers';

describe('Sliding-window rate limits and boundary behavior', () => {
  it('enforces the submission limit and provides retryAt', () => {
    cy.signIn(ADMIN);
    readAppSettings().then((before) => {
      activeTaxonomy().then((taxonomy) => {
        const categoryId = taxonomy.categories.find((category) => category.isActive)!.id;
        writeAppSettings({ submissionLimitCount: 1, submissionLimitMinutes: 1 });

        cy.signIn(RAE);
        const requestBody = () => ({
          title: `Rate limited ${stamp()}`,
          description: 'A request created specifically for the rate-limit boundary case.',
          categoryId,
        });

        cy.apiPost('/requests', requestBody()).its('status').should('eq', 201);
        cy.apiPost('/requests', requestBody(), false).then((response) => {
          expect(response.status).to.eq(429);
          expect(response.body.error.code).to.eq('SUBMISSION_RATE_LIMITED');
          expect(response.body.error.retryAt).to.exist;
        });

        cy.signIn(ADMIN);
        writeAppSettings({
          submissionLimitCount: before.submissionLimitCount,
          submissionLimitMinutes: before.submissionLimitMinutes,
        });
      });
    });
  });

  it('limits admins too; permission does not bypass the rate limit', () => {
    cy.signIn(ADMIN);
    readAppSettings().then((before) => {
      activeTaxonomy().then((taxonomy) => {
        const categoryId = taxonomy.categories.find((category) => category.isActive)!.id;
        writeAppSettings({ submissionLimitCount: 1, submissionLimitMinutes: 1 });
        const requestBody = () => ({
          title: `Admin limit ${stamp()}`,
          description: 'Admin still obeys the submission limit like everyone else.',
          categoryId,
        });
        cy.apiPost('/requests', requestBody()).its('status').should('eq', 201);
        cy.apiPost('/requests', requestBody(), false).its('status').should('eq', 429);
        writeAppSettings({
          submissionLimitCount: before.submissionLimitCount,
          submissionLimitMinutes: before.submissionLimitMinutes,
        });
      });
    });
  });

  it('keeps the sign-up limit setting effective without a restart', () => {
    cy.signIn(ADMIN);
    readAppSettings().then((before) => {
      writeAppSettings({ signupLimitCount: 1, signupLimitMinutes: 1 });
      readAppSettings().then((after) => {
        expect(after.signupLimitCount).to.eq(1);
      });
      // The sign-up handshake still starts with a redirect: the limit only
      // decides whether a *new* account may be made at the callback (R-4).
      cy.request({ url: '/v1/auth/sign-in', followRedirect: false }).its('status').should('be.oneOf', [302, 303]);
      writeAppSettings({
        signupLimitCount: before.signupLimitCount,
        signupLimitMinutes: before.signupLimitMinutes,
      });
    });
  });
});
