import { Inject, Injectable } from '@nestjs/common';
import { USER_SETTINGS_REPOSITORY, UserSettingsRepository } from '../port/settings-repository';
import { UserSettings } from '../../domain/entity/user-settings';
import { Language } from '../../domain/entity/code-defaults';
import { ReadUserSettings } from './read-user-settings';

/**
 * R-60: a person can only change a fixed list of their *own* settings — the
 * language and the two email choices.
 *
 * The user id comes from the guard chain, never from the request body (R-7), so
 * there is no way to spell "change someone else's settings" here. Trying to
 * change an admin setting, a theme or a sort is refused at the boundary by the
 * DTO, which has no such field, and the global pipe rejects unknown fields with
 * a message rather than ignoring them.
 */
@Injectable()
export class ChangeMySettings {
  public constructor(
    @Inject(USER_SETTINGS_REPOSITORY) private readonly repository: UserSettingsRepository,
    private readonly readUserSettings: ReadUserSettings,
  ) {}

  public async execute(
    userId: string,
    changes: {
      language?: Language | null;
      notifyOnComment?: boolean;
      notifyOnStatusChange?: boolean;
    },
  ): Promise<UserSettings> {
    const settings = await this.readUserSettings.execute(userId);
    settings.change(changes);
    return this.repository.save(settings);
  }
}
