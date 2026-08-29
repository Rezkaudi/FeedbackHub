import { AppSettings } from '../../domain/entity/app-settings';
import { UserSettings } from '../../domain/entity/user-settings';

export interface AppSettingsRepository {
  /**
   * Null when there is no row. The caller falls back to the code defaults
   * rather than failing — R-42 says a missing switch must never leave the app
   * in an unknown state.
   */
  load(): Promise<AppSettings | null>;
  save(settings: AppSettings): Promise<AppSettings>;
}

export interface UserSettingsRepository {
  /** Null when the person has changed nothing yet. */
  findByUserId(userId: string): Promise<UserSettings | null>;
  save(settings: UserSettings): Promise<UserSettings>;
}

export const APP_SETTINGS_REPOSITORY = Symbol('AppSettingsRepository');
export const USER_SETTINGS_REPOSITORY = Symbol('UserSettingsRepository');
