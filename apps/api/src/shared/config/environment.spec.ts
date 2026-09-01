import { loadEnvironment } from './environment';

/**
 * R-53: server addresses, database address and secrets come from the environment.
 * Product settings never do.
 * R-3f: cookie names and lifetimes are never written in the code.
 * R-102: no secret has a default. A missing one stops the boot.
 */
const complete: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/feedbackhub',
  REDIS_URL: 'redis://localhost:6379',
  AUTH_ALLOWED_ORIGINS: 'https://feedbackhub.test',
  OIDC_ISSUER_URL: 'http://localhost:8080/realms/feedbackhub',
  OIDC_CLIENT_ID: 'feedbackhub-api',
  OIDC_CLIENT_SECRET: 'stub',
  OIDC_REDIRECT_URI: 'https://feedbackhub.test/auth/callback',
  APP_BASE_URL: 'https://feedbackhub.test',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'FeedbackHub <no-reply@feedbackhub.test>',
  SMTP_TIMEOUT: '10',
};

describe('loadEnvironment', () => {
  describe('the origin allowlist (R-3g)', () => {
    it('refuses to start when AUTH_ALLOWED_ORIGINS is missing', () => {
      const { AUTH_ALLOWED_ORIGINS: _omitted, ...withoutOrigins } = complete;

      expect(() => loadEnvironment(withoutOrigins)).toThrow(/AUTH_ALLOWED_ORIGINS/);
    });

    it('refuses to start when AUTH_ALLOWED_ORIGINS is empty, rather than allowing everything', () => {
      expect(() => loadEnvironment({ ...complete, AUTH_ALLOWED_ORIGINS: '' })).toThrow(
        /AUTH_ALLOWED_ORIGINS/,
      );
    });

    it('refuses a wildcard, because an allowlist of everything is not an allowlist', () => {
      expect(() => loadEnvironment({ ...complete, AUTH_ALLOWED_ORIGINS: '*' })).toThrow(
        /AUTH_ALLOWED_ORIGINS/,
      );
    });

    it('reads a comma-separated list into trimmed origins', () => {
      const config = loadEnvironment({
        ...complete,
        AUTH_ALLOWED_ORIGINS: 'https://a.test, https://b.test',
      });

      expect(config.auth.allowedOrigins).toEqual(['https://a.test', 'https://b.test']);
    });
  });

  describe('secrets (R-102)', () => {
    it('refuses to start without the OIDC client secret, and never invents one', () => {
      const { OIDC_CLIENT_SECRET: _omitted, ...withoutSecret } = complete;

      expect(() => loadEnvironment(withoutSecret)).toThrow(/OIDC_CLIENT_SECRET/);
    });

    it('refuses to start without a database address', () => {
      const { DATABASE_URL: _omitted, ...withoutDatabase } = complete;

      expect(() => loadEnvironment(withoutDatabase)).toThrow(/DATABASE_URL/);
    });
  });

  describe('cookies come from config, not from the code (R-3f)', () => {
    it('uses the documented defaults when nothing is set', () => {
      const config = loadEnvironment(complete);

      expect(config.auth.cookies).toEqual({
        accessName: 'at',
        refreshName: 'rt',
        accessMaxAgeSeconds: 86400,
        refreshMaxAgeSeconds: 604800,
        refreshPath: '/v1/auth',
        secure: true,
      });
    });

    it('lets every cookie setting be overridden', () => {
      const config = loadEnvironment({
        ...complete,
        AUTH_COOKIE_ACCESS_NAME: 'access',
        AUTH_COOKIE_REFRESH_NAME: 'refresh',
        AUTH_COOKIE_ACCESS_MAX_AGE: '60',
        AUTH_COOKIE_REFRESH_MAX_AGE: '600',
        AUTH_COOKIE_REFRESH_PATH: '/v1/auth/refresh',
        AUTH_COOKIE_SECURE: 'false',
      });

      expect(config.auth.cookies).toEqual({
        accessName: 'access',
        refreshName: 'refresh',
        accessMaxAgeSeconds: 60,
        refreshMaxAgeSeconds: 600,
        refreshPath: '/v1/auth/refresh',
        secure: false,
      });
    });
  });

  describe('mail (R-128)', () => {
    it('requires a timeout, because the library default is minutes and would hang the job', () => {
      const { SMTP_TIMEOUT: _omitted, ...withoutTimeout } = complete;

      expect(() => loadEnvironment(withoutTimeout)).toThrow(/SMTP_TIMEOUT/);
    });

    it('is switched off by default, so development never sends real mail', () => {
      expect(loadEnvironment(complete).mail.enabled).toBe(false);
    });
  });

  it('reports every problem at once, not just the first', () => {
    const {
      DATABASE_URL: _a,
      OIDC_CLIENT_SECRET: _b,
      AUTH_ALLOWED_ORIGINS: _c,
      ...broken
    } = complete;

    expect(() => loadEnvironment(broken)).toThrow(
      /DATABASE_URL[\s\S]*OIDC_CLIENT_SECRET|OIDC_CLIENT_SECRET[\s\S]*DATABASE_URL/,
    );
  });

  it('carries no product setting, because those live in the database (R-53)', () => {
    const config = loadEnvironment({
      ...complete,
      FEATURE_COMMENTS_ENABLED: 'false',
      SUBMISSION_LIMIT_COUNT: '999',
      REGISTRATION_POLICY: 'open',
    });

    const flattened = JSON.stringify(config);
    expect(flattened).not.toContain('999');
    expect(flattened).not.toContain('REGISTRATION_POLICY');
    expect(Object.keys(config)).not.toContain('features');
  });
});
