import { ADMIN, SAM } from '../support/accounts';

const KEYCLOAK_AUTH = /realms\/feedbackhub\/protocol\/openid-connect\/auth/;

describe('Authentication, cookies and session lifecycle', () => {
  it('signs in through the real Keycloak browser flow', () => {
    cy.signIn(SAM);
    cy.visit('/');
    cy.location('origin').should('eq', Cypress.config('baseUrl'));
    cy.contains('h1', /Feedback/i).should('be.visible');
  });

  it('does not expose application tokens to web storage', () => {
    cy.signIn(SAM);
    cy.visit('/');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('accessToken')).to.be.null;
      expect(win.localStorage.getItem('refreshToken')).to.be.null;
      expect(win.sessionStorage.getItem('accessToken')).to.be.null;
      expect(win.sessionStorage.getItem('refreshToken')).to.be.null;
    });
  });

  it('sets the expected application cookies after sign-in', () => {
    cy.signIn(SAM);
    cy.getCookies().then((cookies) => {
      const access = cookies.find((cookie) => cookie.name === 'at');
      const refresh = cookies.find((cookie) => cookie.name === 'rt');
      expect(access, 'access cookie').to.exist;
      expect(refresh, 'refresh cookie').to.exist;
      expect(access!.httpOnly).to.eq(true);
      expect(refresh!.httpOnly).to.eq(true);
      expect(String(access!.sameSite).toLowerCase()).to.eq('lax');
      expect(access!.path).to.eq('/');
      expect(String(refresh!.sameSite).toLowerCase()).to.eq('strict');
      expect(refresh!.path).to.contain('/v1/auth');
    });
  });

  it('makes exactly one bootstrap call during a normal reload', () => {
    cy.signIn(SAM);
    cy.visit('/');
    cy.contains('h1', /Feedback/i).should('be.visible');
    let bootstrapCalls = 0;
    cy.intercept('GET', '/v1/bootstrap', (req) => {
      bootstrapCalls += 1;
      req.continue();
    }).as('bootstrap');
    cy.reload();
    cy.contains('h1', /Feedback/i).should('be.visible');
    cy.wait('@bootstrap');
    cy.wait(500).then(() => {
      expect(bootstrapCalls).to.eq(1);
    });
  });

  it('keeps admin and user sessions isolated', () => {
    cy.signIn(ADMIN);
    cy.apiGet('/settings/app').its('status').should('eq', 200);
    cy.signIn(SAM);
    cy.apiPatch('/settings/app', { featureCommentsEnabled: true }, false).its('status').should('eq', 403);
  });

  it('signs out and lands on the identity provider, not a raw JSON error', () => {
    cy.signIn(SAM);
    cy.visit('/');
    cy.contains('button', /sign out/i).click();
    cy.url({ timeout: 20_000 }).should('match', KEYCLOAK_AUTH);
    // The sign-out response cleared the cookies server-side: the session no
    // longer works, and the page we land on is the IdP form, not raw JSON.
    cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });

  it('makes a signed-out API call return 401', () => {
    cy.signIn(SAM);
    cy.visit('/');
    cy.contains('button', /sign out/i).click();
    cy.url({ timeout: 20_000 }).should('match', KEYCLOAK_AUTH);
    cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });

  it('requires authentication for protected application routes', () => {
    cy.clearCookies();
    cy.visit('/settings');
    cy.url({ timeout: 20_000 }).should('match', KEYCLOAK_AUTH);
  });
});
