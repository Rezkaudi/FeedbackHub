import { api } from '../../support/clients/api.client';
import { SEED } from '../../support/fixtures/seed-ids';
import { ADMIN } from '../../support/fixtures/accounts';

/**
 * Fails fast and loud if the stack itself is not in the state every other
 * spec assumes. Read-only: this file creates nothing and cleans up nothing.
 */
describe('the stack is up, unauthenticated', () => {
  it('answers both health checks', () => {
    cy.request('/health/live').its('status').should('eq', 200);
    cy.request('/health/ready').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.checks).to.deep.equal({ database: 'up', redis: 'up', identityProvider: 'up' });
    });
  });

  it('refuses an unauthenticated bootstrap with the documented envelope', () => {
    cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(401);
      expect(response.body.error).to.have.all.keys('code', 'message', 'requestId');
      expect(response.body.error.code).to.eq('UNAUTHORIZED');
    });
  });

  it('proxies /v1 on the same origin as the web app (no CORS preflight needed)', () => {
    cy.request({ url: '/v1/bootstrap', failOnStatusCode: false }).then((response) => {
      expect(response.headers).to.not.have.property('access-control-allow-origin');
    });
  });

  it('serves the Keycloak OIDC discovery document for the feedbackhub realm', () => {
    cy.request(`${Cypress.env('keycloakOrigin')}/realms/feedbackhub/.well-known/openid-configuration`).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body.issuer).to.include('/realms/feedbackhub');
      },
    );
  });

  it('has a reachable Mailpit', () => {
    cy.request(`${Cypress.env('mailpitOrigin')}/api/v1/info`).its('status').should('eq', 200);
  });
});

describe('the stack is seeded, as admin', () => {
  beforeEach(() => {
    cy.signIn(ADMIN);
  });

  it('has the seeded taxonomy: five categories with legacy retired, six statuses with new as default', () => {
    api.taxonomy.read().then((taxonomy) => {
      expect(taxonomy.categories.map((c) => c.slug).sort()).to.deep.equal([...SEED.categories].sort());
      const legacy = taxonomy.categories.find((c) => c.slug === SEED.retiredCategorySlug);
      expect(legacy?.isActive, 'legacy category should be retired').to.eq(false);

      expect(taxonomy.statuses.map((s) => s.slug).sort()).to.deep.equal([...SEED.statuses].sort());
      const defaultStatus = taxonomy.statuses.find((s) => s.isDefault);
      expect(defaultStatus?.slug).to.eq(SEED.defaultStatusSlug);
    });
  });

  it('has the four seeded requests, resolvable by id', () => {
    for (const id of Object.values(SEED.requests)) {
      api.requests.read(id).its('id').should('eq', id);
    }
  });

  it('has the seeded pinned request with three votes and two published comments', () => {
    api.requests.read(SEED.requests.darkMode).then((request) => {
      expect(request.isPinned).to.eq(true);
      expect(request.voteCount).to.eq(3);
      expect(request.commentCount).to.eq(2);
    });
  });

  it('has the seeded invitation, still waiting', () => {
    api.invitations.list().then((response) => {
      const invited = response.body.find((i) => i.email === SEED.invitedAddress);
      expect(invited, 'seeded invitation should exist').to.not.be.undefined;
      expect(invited?.acceptedAt).to.eq(null);
    });
  });

  it('bootstrap has the documented shape for a signed-in admin', () => {
    api.bootstrap().then((boot) => {
      expect(boot.user).to.include.keys('id', 'displayName', 'avatarUrl', 'role');
      expect(boot.user.role).to.eq('admin');
      expect(boot.settings).to.include.keys('language', 'notifyOnComment', 'notifyOnStatusChange');
      expect(boot.features).to.include.keys('commentsEnabled', 'commentsRequireApproval');
      expect(boot.categories).to.be.an('array');
      expect(boot.statuses).to.be.an('array');
    });
  });
});
