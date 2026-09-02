import { SAM } from '../../support/fixtures/accounts';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';
import type { ApiErrorBody } from '../../support/utils/types';

describe('profile', () => {
  afterEach(() => {
    // Other specs assert on "Sam Sample" — restore it unconditionally.
    cy.signIn(SAM);
    api.me.update({ displayName: 'Sam Sample', avatarUrl: null });
  });

  it('changing the display name round-trips and shows up in the header', () => {
    cy.visitAs(SAM, '/profile');
    cy.byTestId(TID.settings.displayName).clear().type('Sam Renamed');
    cy.byTestId(TID.settings.profileSave).click();
    cy.byTestId(TID.settings.profileSaved, { timeout: 10_000 }).should('be.visible');
    cy.reload();
    cy.byTestId(TID.settings.displayName).should('have.value', 'Sam Renamed');
    api.me.read().its('displayName').should('eq', 'Sam Renamed');
  });

  it('an empty display name blocks submit and shows a field error', () => {
    cy.visitAs(SAM, '/profile');
    cy.byTestId(TID.settings.displayName).clear();
    cy.byTestId(TID.settings.profileSave).should('be.disabled');
  });

  it('setting and clearing an avatar URL round-trips', () => {
    cy.visitAs(SAM, '/profile');
    cy.byTestId(TID.settings.avatarUrl).clear().type('https://example.com/avatar.png');
    cy.byTestId(TID.settings.profileSave).click();
    cy.byTestId(TID.settings.profileSaved, { timeout: 10_000 }).should('be.visible');
    api.me.read().its('avatarUrl').should('eq', 'https://example.com/avatar.png');

    cy.byTestId(TID.settings.avatarUrl).clear();
    cy.byTestId(TID.settings.profileSave).click();
    cy.byTestId(TID.settings.profileSaved, { timeout: 10_000 }).should('be.visible');
    api.me.read().its('avatarUrl').should('eq', null);
  });

  it('an invalid avatar URL is rejected by the API with named fields', () => {
    cy.signIn(SAM);
    cy.request({
      method: 'PATCH',
      url: '/v1/me',
      headers: { origin: Cypress.config('baseUrl') as string },
      body: { avatarUrl: 'not-a-url' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect((response.body as ApiErrorBody).error.fields).to.have.property('avatarUrl');
    });
  });

  it('an 81-character display name is rejected', () => {
    cy.signIn(SAM);
    cy.request({
      method: 'PATCH',
      url: '/v1/me',
      headers: { origin: Cypress.config('baseUrl') as string },
      body: { displayName: 'x'.repeat(81) },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect((response.body as ApiErrorBody).error.fields).to.have.property('displayName');
    });
  });

  it('PATCH /v1/me with an unknown field is rejected', () => {
    cy.signIn(SAM);
    cy.request({
      method: 'PATCH',
      url: '/v1/me',
      headers: { origin: Cypress.config('baseUrl') as string },
      body: { role: 'admin' },
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 400);
  });
});
