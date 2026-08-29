import { Inject, Injectable } from '@nestjs/common';
import { APP_SETTINGS_REPOSITORY, AppSettingsRepository } from '../port/settings-repository';
import { AppSettings, AppSettingsState } from '../../domain/entity/app-settings';
import { ReadAppSettings } from './read-app-settings';

/**
 * R-69, R-70: the admin changes these while the app runs, and it works with no
 * restart. Nothing is cached, so the next call already sees the new value.
 *
 * R-131/SRS 15.7: the entity checks every field before applying any of it, so a
 * bad value leaves the settings exactly as they were — never half-saved.
 */
@Injectable()
export class ChangeAppSettings {
  public constructor(
    @Inject(APP_SETTINGS_REPOSITORY) private readonly repository: AppSettingsRepository,
    private readonly readAppSettings: ReadAppSettings,
  ) {}

  public async execute(changes: Partial<AppSettingsState>): Promise<AppSettings> {
    const settings = await this.readAppSettings.execute();
    settings.change(changes);
    return this.repository.save(settings);
  }
}
