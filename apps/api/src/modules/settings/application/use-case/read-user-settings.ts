import { Inject, Injectable } from '@nestjs/common';
import { USER_SETTINGS_REPOSITORY, UserSettingsRepository } from '../port/settings-repository';
import { UserSettings } from '../../domain/entity/user-settings';

/** R-51: no row means the person changed nothing — use the code defaults. */
@Injectable()
export class ReadUserSettings {
  public constructor(
    @Inject(USER_SETTINGS_REPOSITORY) private readonly repository: UserSettingsRepository,
  ) {}

  public async execute(userId: string): Promise<UserSettings> {
    return (await this.repository.findByUserId(userId)) ?? UserSettings.defaultsFor(userId);
  }
}
