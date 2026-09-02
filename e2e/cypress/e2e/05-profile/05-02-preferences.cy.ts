import { SAM } from '../../support/fixtures/accounts';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

describe('personal preferences (/v1/settings/me)', () => {
  afterEach(() => {
    cy.signIn(SAM);
    api.settings.me.update({ notifyOnComment: true, notifyOnStatusChange: true, language: null });
  });

  it('toggling "email me on comments" persists server-side', () => {
    cy.visitAs(SAM, '/profile');
    cy.byTestId(TID.settings.notifyComment).uncheck({ force: true });
    api.settings.me.read().its('notifyOnComment').should('eq', false);
  });

  it('toggling "email me on status change" persists server-side', () => {
    cy.visitAs(SAM, '/profile');
    cy.byTestId(TID.settings.notifyStatus).uncheck({ force: true });
    api.settings.me.read().its('notifyOnStatusChange').should('eq', false);
  });

  it('changing the account language persists server-side (distinct from the header\'s local-only switch)', () => {
    cy.visitAs(SAM, '/profile');
    cy.byTestId(TID.settings.accountLanguage + '-ar').click({ force: true });
    api.settings.me.read().its('language').should('eq', 'ar');
  });

  it('device preferences (theme, default sort/filters) live only in localStorage, never in /v1/settings/me', () => {
    cy.visitAs(SAM, '/profile');
    cy.window().then((win) => {
      win.localStorage.setItem('fh.theme', 'dark');
    });
    api.settings.me.read().then((settings) => {
      expect(settings).to.not.have.property('theme');
      expect(settings).to.not.have.property('defaultSort');
    });
  });

  it('PATCH /v1/settings/me with an unknown field is 400', () => {
    cy.signIn(SAM);
    cy.request({
      method: 'PATCH',
      url: '/v1/settings/me',
      headers: { origin: Cypress.config('baseUrl') as string },
      body: { theme: 'dark' },
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 400);
  });

  it('a non-admin cannot reach /v1/settings/app but can reach /v1/settings/me', () => {
    cy.signIn(SAM);
    api.settings.app.readRaw().its('status').should('eq', 403);
    api.settings.me.read().its('notifyOnComment').should('be.a', 'boolean');
  });
});
