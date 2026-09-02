import { mailpit, type MailMessage, type MailSummary } from '../clients/mailpit.client';

declare global {
  namespace Cypress {
    interface Chainable {
      /** Thin wrappers over `clients/mailpit.client.ts` so specs read as
       *  prose: `cy.mailWaitFor('to:sam@feedbackhub.local')`. */
      mailWaitFor(query: string, opts?: { min?: number; timeout?: number }): Chainable<MailSummary[]>;
      mailExpectNone(query: string, settleMs?: number): Chainable<void>;
      mailLatestFor(address: string): Chainable<MailMessage>;
      mailLinkFor(address: string, opts?: { subjectContains?: string }): Chainable<string>;
    }
  }
}

Cypress.Commands.add('mailWaitFor', (query, opts) => mailpit.waitFor(query, opts));
Cypress.Commands.add('mailExpectNone', (query, settleMs) => mailpit.expectNone(query, settleMs));
Cypress.Commands.add('mailLatestFor', (address) => mailpit.latestFor(address));
Cypress.Commands.add('mailLinkFor', (address, opts) => mailpit.linkFor(address, opts));

export {};
