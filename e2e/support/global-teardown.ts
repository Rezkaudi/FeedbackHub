import { chromium } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { ADMIN } from './accounts';
import { signIn } from './sign-in';
import { writeAppSettings } from './api';
import { SAVED_SETTINGS } from './global-setup';

/**
 * Put back what the setup moved.
 *
 * It runs whether the tests passed or failed, and it is deliberately quiet
 * about its own failures: a teardown that throws turns a green run red for a
 * reason that has nothing to do with the app. It says what went wrong and lets
 * the result stand.
 */
const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:4200';

export default async function globalTeardown(): Promise<void> {
  let saved: { submissionLimitCount: number; submissionLimitMinutes: number };
  try {
    saved = JSON.parse(await readFile(SAVED_SETTINGS, 'utf8')) as typeof saved;
  } catch {
    // The setup never got far enough to save anything, so there is nothing to
    // put back.
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Origin: BASE_URL },
  });

  try {
    const page = await context.newPage();
    await signIn(page, ADMIN);
    await writeAppSettings(page, saved);
    await rm(SAVED_SETTINGS, { force: true });
  } catch (cause) {
    console.warn(
      `The submission limit could not be put back (it is still lifted): ${String(cause)}`,
    );
  } finally {
    await context.close();
    await browser.close();
  }
}
