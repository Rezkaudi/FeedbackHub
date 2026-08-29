import { Inject, Injectable } from '@nestjs/common';
import {
  APP_SETTINGS_REPOSITORY,
  AppSettingsRepository,
} from '../port/settings-repository';
import { AppSettings } from '../../domain/entity/app-settings';
import { Logger } from '../../../../shared/logging/logger';

/**
 * R-42: a missing or broken switch falls back to the code default, so a bad
 * settings row can never switch something on by accident — and can never take
 * the app down either.
 *
 * Reading is the hottest path in the app: every comment, vote and new request
 * asks for the limits and the switch. It is one indexed single-row read, which
 * is cheap; a cache would add a staleness window that R-70 ("works with no
 * restart") would then have to reason about, so we do not have one.
 */
@Injectable()
export class ReadAppSettings {
  public constructor(
    @Inject(APP_SETTINGS_REPOSITORY) private readonly repository: AppSettingsRepository,
    private readonly logger: Logger,
  ) {}

  public async execute(): Promise<AppSettings> {
    try {
      return (await this.repository.load()) ?? AppSettings.codeDefaults();
    } catch (error) {
      // Degrade, never corrupt. A settings row we cannot read must not stop a
      // person commenting; it falls back to what we ship with.
      this.logger.error({ err: error }, 'Could not read app settings; using code defaults');
      return AppSettings.codeDefaults();
    }
  }
}
