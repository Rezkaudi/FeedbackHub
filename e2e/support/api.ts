import type { APIResponse, Page } from '@playwright/test';

/**
 * Calling the API directly, with the session the browser already holds.
 *
 * `page.request` shares the browser context's cookie jar, so a call made
 * through it carries the very same HttpOnly cookies the app uses — no token is
 * minted and nothing is faked (R-160). That is what makes it a fair way to
 * prove R-70: the person really is signed in, really is not an admin, and the
 * server really refuses them.
 *
 * Playwright's config sets the `Origin` header for these calls, because the
 * API refuses a write that names no origin it knows (R-3g). A call made here
 * without one would be refused for the wrong reason and the test would pass
 * while proving nothing.
 */

/** The API sits behind the same origin as the app, under /v1 (R-3h). */
export const api = (path: string): string => `/v1${path}`;

export async function get(page: Page, path: string): Promise<APIResponse> {
  return page.request.get(api(path));
}

export async function post(page: Page, path: string, data?: unknown): Promise<APIResponse> {
  return page.request.post(api(path), data === undefined ? {} : { data });
}

export async function patch(page: Page, path: string, data: unknown): Promise<APIResponse> {
  return page.request.patch(api(path), { data });
}

export async function del(page: Page, path: string): Promise<APIResponse> {
  return page.request.delete(api(path));
}

/**
 * The application settings, as the server has them.
 *
 * Tests that turn a switch off must put it back, and putting it back means
 * knowing what it was — not assuming the seeded value, because an earlier test
 * or an earlier run may have moved it.
 */
export interface AppSettings {
  registrationPolicy: string;
  allowedEmailDomains: string[];
  submissionLimitCount: number;
  submissionLimitMinutes: number;
  voteLimitCount: number;
  voteLimitMinutes: number;
  signupLimitCount: number;
  signupLimitMinutes: number;
  commentsRequireApproval: boolean;
  featureCommentsEnabled: boolean;
}

export async function readAppSettings(page: Page): Promise<AppSettings> {
  const response = await get(page, '/settings/app');
  if (!response.ok()) {
    throw new Error(`Could not read the application settings: ${response.status()}`);
  }
  return (await response.json()) as AppSettings;
}

export async function writeAppSettings(page: Page, changes: Partial<AppSettings>): Promise<void> {
  const response = await patch(page, '/settings/app', changes);
  if (!response.ok()) {
    throw new Error(
      `Could not save the application settings: ${response.status()} ${await response.text()}`,
    );
  }
}
