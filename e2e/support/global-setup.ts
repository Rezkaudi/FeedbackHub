import { chromium, request } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { ADMIN } from './accounts';
import { signIn } from './sign-in';
import { readAppSettings, writeAppSettings } from './api';

/**
 * Two jobs before the first test: check the stack is up, and get the run out of
 * the way of the submission rate limit.
 *
 * **The stack.** These tests need all of it. When it is not up, every test
 * fails on its own 20-second wait for a Keycloak page that never comes, and the
 * report says "element not found" thirty times over — which reads like the app
 * is broken. Asking once, first, and failing with a sentence that names the
 * command is worth the twenty lines.
 *
 * **The rate limit.** R-130 lets a person file ten requests an hour, and the
 * suite files two of them. On a fresh stack that is fine; on a machine where
 * the suite has already run four times in the last hour it is not, and the
 * failure looks like a broken form rather than a limit doing its job. So the
 * limit is lifted for the run and put back by the teardown.
 *
 * Lifting it does not leave the rule unproven: `rate-limits.spec.ts` sets its
 * own limit, on purpose, and watches the server refuse. That is the honest
 * trade — one test owns the rule, and the other twenty are not silently
 * fighting it.
 */
const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:4200';

/** Where the teardown finds what to put back. */
export const SAVED_SETTINGS = '.playwright/settings-before-the-run.json';

/** High enough that no run reaches it; still a number, so R-130 is not broken. */
const LIMIT_FOR_THE_RUN = 10_000;

async function reachable(url: string): Promise<boolean> {
  const context = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const response = await context.get(url, { timeout: 5_000, maxRedirects: 0 });
    // Anything that answers is enough. A 302 to Keycloak and a 401 from the API
    // both mean the service is up; only silence means it is not.
    return response.status() > 0;
  } catch {
    return false;
  } finally {
    await context.dispose();
  }
}

async function checkTheStackIsUp(): Promise<void> {
  const checks: ReadonlyArray<{ what: string; url: string }> = [
    { what: 'the front end', url: `${BASE_URL}/` },
    { what: 'the API', url: `${BASE_URL}/health/ready` },
    // The browser reaches the identity provider directly, not through the
    // proxy, so it is a separate thing that can be down.
    {
      what: 'Keycloak',
      url: 'http://localhost:8080/realms/feedbackhub/.well-known/openid-configuration',
    },
  ];

  const missing: string[] = [];
  for (const check of checks) {
    if (!(await reachable(check.url))) {
      missing.push(`${check.what} (${check.url})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `The end-to-end tests need the whole stack, and this is not answering:\n` +
        missing.map((one) => `  - ${one}`).join('\n') +
        `\n\nStart it from the root of the repository and wait for it:\n` +
        `  docker compose up --build -d --wait\n`,
    );
  }
}

async function lettingTheRunSubmitFreely(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Origin: BASE_URL },
  });
  const page = await context.newPage();

  try {
    await signIn(page, ADMIN);
    const before = await readAppSettings(page);

    // On a fresh checkout — CI, every time — nothing has written into
    // .playwright yet, and writeFile does not make the directory for you.
    await mkdir(dirname(SAVED_SETTINGS), { recursive: true });
    await writeFile(
      SAVED_SETTINGS,
      JSON.stringify({
        submissionLimitCount: before.submissionLimitCount,
        submissionLimitMinutes: before.submissionLimitMinutes,
      }),
      'utf8',
    );

    await writeAppSettings(page, { submissionLimitCount: LIMIT_FOR_THE_RUN });
  } finally {
    await context.close();
    await browser.close();
  }
}

export default async function globalSetup(): Promise<void> {
  await checkTheStackIsUp();
  await lettingTheRunSubmitFreely();
}
