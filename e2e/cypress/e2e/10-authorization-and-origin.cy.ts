import { RAE, SAM } from '../support/accounts';
import { IDS, stamp } from '../support/helpers';

const SOME_UUID = '00000000-0000-4000-8000-000000000abc';

describe('Server-side authorization and origin enforcement', () => {
  beforeEach(() => cy.signIn(SAM));

  it('rejects normal-user status changes', () => {
    cy.apiPatch(`/requests/${IDS.raeRequest}/status`, { statusId: SOME_UUID }, false)
      .its('status')
      .should('eq', 403);
  });

  it('rejects normal-user pin changes', () => {
    cy.apiPatch(`/requests/${IDS.raeRequest}/pin`, { pinned: true }, false).its('status').should('eq', 403);
  });

  it('rejects normal-user application settings writes', () => {
    cy.apiPatch('/settings/app', { featureCommentsEnabled: false }, false).its('status').should('eq', 403);
  });

  it('rejects normal-user category and status administration', () => {
    cy.apiPost('/taxonomy/categories', { name: `Nope ${stamp()}`, color: '#123456' }, false)
      .its('status')
      .should('eq', 403);
    cy.apiPost('/taxonomy/statuses', { name: `Nope ${stamp()}`, color: '#123456' }, false)
      .its('status')
      .should('eq', 403);
  });

  it('rejects normal-user pending comment access', () => {
    cy.apiGet('/admin/comments/pending', false).its('status').should('eq', 403);
  });

  it('allows the owner to edit their own request', () => {
    cy.signIn(RAE);
    cy.apiGet(`/requests/${IDS.raeRequest}`).then((response) => {
      const original = (response.body as { description: string }).description;
      cy.apiPatch(`/requests/${IDS.raeRequest}`, { description: original }, false)
        .its('status')
        .should('eq', 200);
    });
  });

  it('rejects writes with an untrusted Origin', () => {
    cy.request({
      method: 'POST',
      url: '/v1/requests',
      headers: { origin: 'https://evil.example' },
      body: {
        title: `Cross-origin ${stamp()}`,
        description: 'This should never cross the origin boundary at all.',
        categoryId: SOME_UUID,
      },
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 403);
  });
});
