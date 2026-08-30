import { ADMIN, RAE, SAM } from '../support/accounts';
import { IDS, readAppSettings, writeAppSettings } from '../support/helpers';

describe('API contract checks that belong in E2E because they use the real browser session', () => {
  it('returns the authenticated bootstrap shape', () => {
    cy.signIn(SAM);
    cy.apiGet('/bootstrap').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.all.keys('user', 'settings', 'features', 'categories', 'statuses');
      expect(response.body.features).to.have.all.keys('commentsEnabled', 'commentsRequireApproval');
      expect(response.body.categories).to.be.an('array');
      expect(response.body.statuses).to.be.an('array');
      expect(response.body.user).to.include.keys('id', 'displayName', 'role');
    });
  });

  it('returns the real request detail shape', () => {
    cy.signIn(SAM);
    cy.apiGet(`/requests/${IDS.spreadsheet}`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include.keys(
        'id',
        'title',
        'description',
        'categoryId',
        'statusId',
        'authorName',
        'voteCount',
        'commentCount',
        'viewerHasVoted',
        'isMine',
      );
    });
  });

  it('enforces comment payload validation', () => {
    cy.signIn(ADMIN);
    writeAppSettings({ featureCommentsEnabled: true });
    cy.signIn(SAM);
    cy.apiPost(`/requests/${IDS.spreadsheet}/comments`, { body: '' }, false)
      .its('status')
      .should('be.oneOf', [400, 422]);
  });

  it('enforces request payload validation', () => {
    cy.signIn(SAM);
    cy.apiPost('/requests', { title: 'x', description: 'y', categoryId: 'bad' }, false)
      .its('status')
      .should('be.oneOf', [400, 422]);
  });

  it('keeps an authored request represented and readable by its author', () => {
    cy.signIn(ADMIN);
    readAppSettings().should('have.property', 'registrationPolicy');
    cy.signIn(RAE);
    cy.apiGet(`/requests/${IDS.raeRequest}`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.authorName).to.be.a('string').and.not.be.empty;
    });
  });
});
