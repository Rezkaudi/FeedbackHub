import type { AppEnvironment } from './environment';

/** The injection token for the environment read once at boot. */
export const APP_ENVIRONMENT = Symbol('APP_ENVIRONMENT');

export type AppEnvironmentToken = AppEnvironment;
