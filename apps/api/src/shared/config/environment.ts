import { z } from 'zod';

/**
 * Everything the app reads from its surroundings, and nothing else.
 *
 * R-53 — server addresses, the database address and secrets come from here.
 * Product settings never do: they live in `app_settings` so an admin can change
 * them while the app runs (R-43, R-69). If you are about to add a feature switch
 * or a limit to this file, it belongs in the database instead.
 *
 * R-102 — no secret has a default. A missing one stops the boot, loudly, at the
 * moment the process starts, rather than at the first request that needed it.
 */

/** A whole number, 1 or more, read from a string. Rejects '', '0', 'abc'. */
const positiveInteger: z.ZodNumber = z.coerce
  .number({ invalid_type_error: 'must be a whole number' })
  .int('must be a whole number')
  .positive('must be 1 or more');

const booleanFromString = z
  .enum(['true', 'false'], {
    errorMap: () => ({ message: "must be exactly 'true' or 'false'" }),
  })
  .transform((value) => value === 'true');

const originList = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .refine((origins) => origins.length > 0, {
    // An empty list must never quietly mean "allow everything" (R-3g).
    message: 'must name at least one origin',
  })
  .refine((origins) => !origins.includes('*'), {
    message: 'must not be "*" — an allowlist of everything is not an allowlist',
  });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: positiveInteger.default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  APP_BASE_URL: z.string().url(),

  // R-3g. No default on purpose: see originList.
  AUTH_ALLOWED_ORIGINS: originList,

  // R-3f. Names and lifetimes are config, never literals in the code.
  AUTH_COOKIE_ACCESS_NAME: z.string().min(1).default('at'),
  AUTH_COOKIE_REFRESH_NAME: z.string().min(1).default('rt'),
  AUTH_COOKIE_ACCESS_MAX_AGE: positiveInteger.default(300),
  AUTH_COOKIE_REFRESH_MAX_AGE: positiveInteger.default(1800),
  // Includes the global 'v1' prefix, and covers the whole auth group: both
  // /v1/auth/refresh and /v1/auth/sign-out need this cookie, and a browser
  // sends a cookie only to paths under its Path.
  AUTH_COOKIE_REFRESH_PATH: z.string().startsWith('/').default('/v1/auth'),
  AUTH_COOKIE_SECURE: booleanFromString.default('true'),

  OIDC_ISSUER_URL: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  OIDC_REDIRECT_URI: z.string().url(),

  // R-128. SMTP_TIMEOUT has no default: the library's own default is minutes,
  // which hangs the email job (R-72).
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: positiveInteger,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().min(1),
  SMTP_TIMEOUT: positiveInteger,
  MAIL_ENABLED: booleanFromString.default('false'),

  // R-96. A hard ceiling on one request, separate from the admin's rate limits.
  REQUEST_BODY_LIMIT: z.string().min(1).default('1mb'),
});

export interface AppEnvironment {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  readonly appBaseUrl: string;
  readonly requestBodyLimit: string;
  readonly database: { readonly url: string };
  readonly redis: { readonly url: string };
  readonly auth: {
    readonly allowedOrigins: readonly string[];
    readonly cookies: {
      readonly accessName: string;
      readonly refreshName: string;
      readonly accessMaxAgeSeconds: number;
      readonly refreshMaxAgeSeconds: number;
      readonly refreshPath: string;
      readonly secure: boolean;
    };
  };
  readonly oidc: {
    readonly issuerUrl: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly redirectUri: string;
  };
  readonly mail: {
    readonly enabled: boolean;
    readonly host: string;
    readonly port: number;
    readonly user?: string;
    readonly password?: string;
    readonly from: string;
    readonly timeoutSeconds: number;
  };
}

export class EnvironmentError extends Error {
  public constructor(problems: readonly string[]) {
    super(
      [
        'The application cannot start: its environment is not valid.',
        ...problems.map((problem) => `  - ${problem}`),
        'See .env.example. No value here has a secret default.',
      ].join('\n'),
    );
    this.name = 'EnvironmentError';
  }
}

/**
 * Reads the environment once, at boot. Throws with *every* problem listed, not
 * just the first, so a misconfigured deployment is fixed in one pass.
 */
export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): AppEnvironment {
  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvironmentError(problems);
  }

  const env = parsed.data;

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    appBaseUrl: env.APP_BASE_URL,
    requestBodyLimit: env.REQUEST_BODY_LIMIT,
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    auth: {
      allowedOrigins: env.AUTH_ALLOWED_ORIGINS,
      cookies: {
        accessName: env.AUTH_COOKIE_ACCESS_NAME,
        refreshName: env.AUTH_COOKIE_REFRESH_NAME,
        accessMaxAgeSeconds: env.AUTH_COOKIE_ACCESS_MAX_AGE,
        refreshMaxAgeSeconds: env.AUTH_COOKIE_REFRESH_MAX_AGE,
        refreshPath: env.AUTH_COOKIE_REFRESH_PATH,
        secure: env.AUTH_COOKIE_SECURE,
      },
    },
    oidc: {
      issuerUrl: env.OIDC_ISSUER_URL,
      clientId: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET,
      redirectUri: env.OIDC_REDIRECT_URI,
    },
    mail: {
      enabled: env.MAIL_ENABLED,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
      timeoutSeconds: env.SMTP_TIMEOUT,
    },
  };
}
