import { Module } from '@nestjs/common';
import { SettingsController } from './http/settings.controller';
import { SettingsService } from './settings.service';
import {
  APP_SETTINGS_REPOSITORY,
  USER_SETTINGS_REPOSITORY,
} from './application/port/settings-repository';
import {
  PrismaAppSettingsRepository,
  PrismaUserSettingsRepository,
} from './infrastructure/persistence/prisma-settings.repository';
import { ReadAppSettings } from './application/use-case/read-app-settings';
import { ChangeAppSettings } from './application/use-case/change-app-settings';
import { ReadUserSettings } from './application/use-case/read-user-settings';
import { ChangeMySettings } from './application/use-case/change-my-settings';

/** Owns `app_settings` and `user_settings`. Nothing else touches them (R-141). */
@Module({
  controllers: [SettingsController],
  providers: [
    { provide: APP_SETTINGS_REPOSITORY, useClass: PrismaAppSettingsRepository },
    { provide: USER_SETTINGS_REPOSITORY, useClass: PrismaUserSettingsRepository },
    ReadAppSettings,
    ChangeAppSettings,
    ReadUserSettings,
    ChangeMySettings,
    SettingsService,
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
