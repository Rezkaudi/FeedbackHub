import { SAM } from '../support/accounts';
import { IDS } from '../support/helpers';

describe('Error states, failed API calls and resilience', () => {
  beforeEach(() => cy.signIn(SAM));

  it('renders an application error instead of a blank screen when bootstrap fails', () => {
    cy.intercept('GET', '/v1/bootstrap', {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong.',
          requestId: 'req_e2e_500',
          isRetryable: true,
        },
      },
    }).as('bootstrapFailure');
    cy.visit('/');
    cy.wait('@bootstrapFailure');
    cy.contains(/could not start FeedbackHub/i).should('be.visible');
    cy.contains('req_e2e_500').should('be.visible');
    cy.contains('button', /try again/i).should('be.visible');
  });

  it('does not expose raw internal status or stack details', () => {
    cy.intercept('GET', '/v1/bootstrap', {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: 'req_hidden',
          isRetryable: true,
          stack: 'SECRET_STACK',
        },
      },
    }).as('failure');
    cy.visit('/');
    cy.wait('@failure');
    cy.get('body').should('not.contain', 'SECRET_STACK');
  });

  it('shows a board error without triggering the auth-refresh behaviour', () => {
    let refreshCalls = 0;
    cy.intercept('POST', '/v1/auth/refresh', (req) => {
      refreshCalls += 1;
      req.reply({ statusCode: 204 });
    });
    cy.intercept({ method: 'GET', pathname: '/v1/requests' }, {
      statusCode: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Server error', requestId: 'req_board' } },
    }).as('serverError');
    cy.visit('/');
    cy.wait('@serverError');
    cy.contains(/could not load the board/i).should('be.visible');
    cy.wait(500).then(() => expect(refreshCalls).to.eq(0));
  });

  it('can recover after a transient bootstrap failure', () => {
    let attempts = 0;
    cy.intercept('GET', '/v1/bootstrap', (request) => {
      attempts += 1;
      if (attempts === 1) {
        request.reply({
          statusCode: 500,
          body: {
            error: { code: 'TEMPORARY', message: 'Temporary', requestId: 'req_retry', isRetryable: true },
          },
        });
      } else {
        request.continue();
      }
    }).as('bootstrapRetry');
    cy.visit('/');
    cy.contains(/could not start FeedbackHub/i).should('be.visible');
    cy.contains('button', /try again/i).click();
    // The retry re-runs the one start-up call and recovers into the board.
    cy.contains('h1', /Feedback/i, { timeout: 20_000 }).should('be.visible');
  });

  it('does not loop on repeated 401 responses', () => {
    let requestCount = 0;
    cy.intercept({ method: 'GET', pathname: `/v1/requests/${IDS.spreadsheet}` }, (req) => {
      requestCount += 1;
      req.reply({ statusCode: 401, body: { error: { code: 'UNAUTHORIZED', message: 'no' } } });
    });
    cy.intercept('POST', '/v1/auth/refresh', { statusCode: 204 });
    cy.visit(`/requests/${IDS.spreadsheet}`);
    cy.wait(1500).then(() => {
      expect(requestCount).to.be.greaterThan(0).and.to.be.lessThan(5);
    });
  });
});
