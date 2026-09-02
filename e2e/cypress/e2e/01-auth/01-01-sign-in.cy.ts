import { ADMIN, ADMIN2, SAM, RAE } from '../../support/fixtures/accounts';
import { TID } from '../../support/utils/testids';

describe('sign in', () => {
  it('sends an anonymous visitor to the Keycloak login page', () => {
    cy.visit('/');
    cy.origin(Cypress.env('keycloakOrigin'), () => {
      cy.location('pathname', { timeout: 30_000 }).should('include', '/realms/feedbackhub/');
      cy.get('#username').should('be.visible');
      cy.get('#password').should('be.visible');
    });
  });

  for (const account of [ADMIN, ADMIN2, SAM, RAE]) {
    it(`signs ${account.displayName} in and reaches the board`, () => {
      cy.signIn(account);
      cy.visit('/');
      cy.byTestId(TID.header.userMenuTrigger).should('be.visible');
      cy.byTestId(TID.header.userMenuTrigger).click();
      if (account.isAdmin) {
        cy.byTestId(TID.header.adminBadge).should('be.visible');
        cy.byTestId(TID.header.adminLink).should('exist');
      } else {
        cy.byTestId(TID.header.adminBadge).should('not.exist');
        cy.byTestId(TID.header.adminLink).should('not.exist');
      }
    });
  }

  it('sets an httpOnly access cookie on the app path and a strict refresh cookie scoped to /v1/auth', () => {
    cy.signIn(ADMIN);
    cy.visit('/');
    cy.getCookies().then((cookies) => {
      const at = cookies.find((c) => c.name === 'at');
      const rt = cookies.find((c) => c.name === 'rt');
      expect(at, 'access cookie "at" should exist').to.not.be.undefined;
      expect(at?.httpOnly).to.eq(true);
      expect(at?.sameSite).to.eq('lax');
      expect(at?.path).to.eq('/');

      expect(rt, 'refresh cookie "rt" should exist').to.not.be.undefined;
      expect(rt?.httpOnly).to.eq(true);
      expect(rt?.sameSite).to.eq('strict');
      expect(rt?.path).to.include('/v1/auth');
    });
  });

  it('GET /v1/auth/sign-in redirects to the Keycloak authorization endpoint with PKCE params', () => {
    cy.request({ url: '/v1/auth/sign-in', followRedirect: false }).then((response) => {
      expect(response.status).to.be.oneOf([302, 303]);
      const location = response.headers.location as string;
      expect(location).to.include('/realms/feedbackhub/protocol/openid-connect/auth');
      expect(location).to.include('code_challenge=');
      expect(location).to.include('code_challenge_method=S256');
      expect(location).to.include('state=');
    });
  });

  it('remembers a deep link and returns to it after signing in', () => {
    cy.visit('/profile');
    cy.origin(Cypress.env('keycloakOrigin'), { args: { username: ADMIN.username, password: ADMIN.password } }, (args) => {
      cy.get('#username', { timeout: 30_000 }).type(args.username);
      cy.get('#password').type(args.password, { log: false });
      cy.get('#kc-login').click();
    });
    cy.location('pathname', { timeout: 20_000 }).should('eq', '/profile');
  });

  it('a wrong password re-renders the Keycloak form without ever reaching the app', () => {
    cy.visit('/');
    cy.origin(Cypress.env('keycloakOrigin'), { args: { username: ADMIN.username } }, (args) => {
      cy.get('#username', { timeout: 30_000 }).type(args.username);
      cy.get('#password').type('definitely-the-wrong-password', { log: false });
      cy.get('#kc-login').click();
      cy.get('#input-error-client-password, .pf-v5-c-alert, .kc-feedback-text', { timeout: 20_000 }).should('exist');
      cy.get('#username').should('exist');
    });
    cy.location('origin').should('eq', Cypress.env('keycloakOrigin'));
  });
});
