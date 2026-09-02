/** Keycloak Admin REST client. Used for ephemeral test users, forcing required
 *  actions (VERIFY_EMAIL / UPDATE_PASSWORD), killing sessions server-side, and
 *  temporarily patching the realm (accessTokenLifespan, verifyEmail) for the
 *  session-lifecycle and refused-signup specs — always through
 *  `fixtures/realm.fixture.ts`'s `withRealmSettings`, which restores it. */

export interface KcUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  enabled: boolean;
  firstName?: string;
  lastName?: string;
  requiredActions?: string[];
}

export interface NewKcUser {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
  requiredActions?: string[];
  enabled?: boolean;
}

function kcOrigin(): string {
  return String(Cypress.env('keycloakOrigin') ?? 'http://localhost:8080');
}

function realm(): string {
  return String(Cypress.env('keycloakRealm') ?? 'feedbackhub');
}

let cachedToken: { value: string; fetchedAt: number } | null = null;

function fetchToken(): Cypress.Chainable<string> {
  const user = String(Cypress.env('keycloakAdminUser') ?? 'admin');
  const password = String(Cypress.env('keycloakAdminPassword') ?? 'admin');

  return cy
    .request({
      method: 'POST',
      url: `${kcOrigin()}/realms/master/protocol/openid-connect/token`,
      form: true,
      body: { grant_type: 'password', client_id: 'admin-cli', username: user, password },
    })
    .then((response) => {
      const value = (response.body as { access_token: string }).access_token;
      cachedToken = { value, fetchedAt: Date.now() };
      return value;
    });
}

function token(): Cypress.Chainable<string> {
  if (cachedToken && Date.now() - cachedToken.fetchedAt < 45_000) {
    return cy.wrap(cachedToken.value, { log: false });
  }
  return fetchToken();
}

function authed<T = unknown>(
  method: Cypress.HttpMethod,
  path: string,
  body?: unknown,
): Cypress.Chainable<Cypress.Response<T>> {
  return token().then((accessToken) =>
    cy.request<T>({
      method,
      url: `${kcOrigin()}/admin/realms/${realm()}${path}`,
      headers: { Authorization: `Bearer ${accessToken}` },
      body: body as Cypress.RequestBody,
      failOnStatusCode: false,
    }),
  );
}

/** Asserts on `response` and yields a fresh `Chainable<void>`. Cypress's
 *  `.then()` treats a callback whose return type is `void`/`undefined` as
 *  "pass the original subject through" (by design, for chaining convenience)
 *  — returning `cy.wrap(undefined)` here is what actually breaks the chain
 *  down to `Chainable<void>` for every "assert the status and move on"
 *  helper below. */
function expectStatus(response: Cypress.Response<unknown>, oneOf: number[], label: string): Cypress.Chainable<void> {
  expect(response.status, label).to.be.oneOf(oneOf);
  return cy.wrap<void>(undefined, { log: false });
}

export const kc = {
  token,

  createUser(input: NewKcUser): Cypress.Chainable<KcUser> {
    const payload = {
      username: input.email,
      email: input.email,
      emailVerified: input.emailVerified ?? true,
      firstName: input.firstName ?? 'E2E',
      lastName: input.lastName ?? 'Person',
      enabled: input.enabled ?? true,
      requiredActions: input.requiredActions ?? [],
      credentials: [{ type: 'password', value: input.password, temporary: false }],
    };

    return authed('POST', '/users', payload).then((response) => {
      expect(response.status, 'create keycloak user').to.eq(201);
      const location = response.headers.location as string;
      const id = location.substring(location.lastIndexOf('/') + 1);
      return kc.readUser(id);
    });
  },

  readUser(id: string): Cypress.Chainable<KcUser> {
    return authed<KcUser>('GET', `/users/${id}`).its('body');
  },

  findUserByEmail(email: string): Cypress.Chainable<KcUser | null> {
    return authed<KcUser[]>('GET', `/users?email=${encodeURIComponent(email)}&exact=true`).then((response) => {
      const found: KcUser | null = response.body[0] ?? null;
      return cy.wrap(found, { log: false });
    });
  },

  updateUser(id: string, patch: Partial<KcUser>): Cypress.Chainable<void> {
    return authed('PUT', `/users/${id}`, patch).then((response) => expectStatus(response, [204], 'update keycloak user'));
  },

  setPassword(id: string, password: string): Cypress.Chainable<void> {
    return authed('PUT', `/users/${id}/reset-password`, { type: 'password', value: password, temporary: false }).then(
      (response) => expectStatus(response, [204], 'set keycloak password'),
    );
  },

  setEmailVerified(id: string, verified: boolean): Cypress.Chainable<void> {
    return kc.updateUser(id, { emailVerified: verified });
  },

  addRequiredAction(id: string, action: string): Cypress.Chainable<void> {
    return kc.readUser(id).then((user) =>
      kc.updateUser(id, { requiredActions: [...new Set([...(user.requiredActions ?? []), action])] }),
    );
  },

  sendVerifyEmail(id: string): Cypress.Chainable<void> {
    return authed('PUT', `/users/${id}/send-verify-email`).then((response) =>
      expectStatus(response, [200, 204], 'send verify email'),
    );
  },

  executeActionsEmail(id: string, actions: string[]): Cypress.Chainable<void> {
    const clientId = String(Cypress.env('keycloakClientId') ?? 'feedbackhub-api');
    const redirect = encodeURIComponent(
      String(Cypress.env('oidcRedirectUri') ?? 'http://localhost:3000/v1/auth/callback'),
    );
    return authed('PUT', `/users/${id}/execute-actions-email?client_id=${clientId}&redirect_uri=${redirect}`, actions).then(
      (response) => expectStatus(response, [200, 204], 'execute actions email'),
    );
  },

  logoutUser(id: string): Cypress.Chainable<void> {
    return authed('POST', `/users/${id}/logout`).then((response) => expectStatus(response, [204], 'logout keycloak user'));
  },

  sessionCount(id: string): Cypress.Chainable<number> {
    return authed<unknown[]>('GET', `/users/${id}/sessions`).then((response) => response.body.length);
  },

  deleteUser(id: string): Cypress.Chainable<void> {
    return authed('DELETE', `/users/${id}`).then((response) =>
      expectStatus(response, [204, 404], 'delete keycloak user'),
    );
  },

  deleteUserByEmail(email: string): Cypress.Chainable<void> {
    return kc.findUserByEmail(email).then((user): Cypress.Chainable<void> => {
      if (user) {
        return kc.deleteUser(user.id);
      }
      return cy.wrap<void>(undefined, { log: false });
    });
  },

  readRealm(): Cypress.Chainable<Record<string, unknown>> {
    return authed<Record<string, unknown>>('GET', '').its('body');
  },

  /** GET → shallow-merge `patch` → PUT the whole representation back. Callers
   *  should use `fixtures/realm.fixture.ts` rather than this directly, so the
   *  original values are always restored. */
  patchRealm(patch: Record<string, unknown>): Cypress.Chainable<void> {
    return kc.readRealm().then((current) => {
      const merged = { ...current, ...patch };
      return authed('PUT', '', merged).then((response) => expectStatus(response, [204], 'patch realm'));
    });
  },
};
