import { Injectable } from '@nestjs/common';
import { AppSettings as AppSettingsRow, UserSettings as UserSettingsRow } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  AppSettingsRepository,
  UserSettingsRepository,
} from '../../application/port/settings-repository';
import { AppSettings } from '../../domain/entity/app-settings';
import { UserSettings } from '../../domain/entity/user-settings';

/** The single row of `app_settings`. Its id is always 1; a CHECK enforces that. */
const THE_ONLY_ROW = 1;

function toAppSettings(row: AppSettingsRow): AppSettings {
  return AppSettings.rehydrate({
    registrationPolicy: row.registrationPolicy,
    allowedEmailDomains: row.allowedEmailDomains,
    commentsRequireApproval: row.commentsRequireApproval,
    signupLimitCount: row.signupLimitCount,
    signupLimitMinutes: row.signupLimitMinutes,
    submissionLimitCount: row.submissionLimitCount,
    submissionLimitMinutes: row.submissionLimitMinutes,
    voteLimitCount: row.voteLimitCount,
    voteLimitMinutes: row.voteLimitMinutes,
    featureCommentsEnabled: row.featureCommentsEnabled,
  });
}

@Injectable()
export class PrismaAppSettingsRepository implements AppSettingsRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async load(): Promise<AppSettings | null> {
    const row = await this.prisma.appSettings.findUnique({ where: { id: THE_ONLY_ROW } });
    return row === null ? null : toAppSettings(row);
  }

  /**
   * Upsert rather than update: the row may not exist yet on a fresh database,
   * and an admin saving settings should not have to care which case they are in.
   */
  public async save(settings: AppSettings): Promise<AppSettings> {
    const state = settings.snapshot();
    const columns = {
      registrationPolicy: state.registrationPolicy,
      allowedEmailDomains: state.allowedEmailDomains,
      commentsRequireApproval: state.commentsRequireApproval,
      signupLimitCount: state.signupLimitCount,
      signupLimitMinutes: state.signupLimitMinutes,
      submissionLimitCount: state.submissionLimitCount,
      submissionLimitMinutes: state.submissionLimitMinutes,
      voteLimitCount: state.voteLimitCount,
      voteLimitMinutes: state.voteLimitMinutes,
      featureCommentsEnabled: state.featureCommentsEnabled,
    };

    const row = await this.prisma.appSettings.upsert({
      where: { id: THE_ONLY_ROW },
      create: { id: THE_ONLY_ROW, ...columns },
      update: columns,
    });

    return toAppSettings(row);
  }
}

function toUserSettings(row: UserSettingsRow): UserSettings {
  return UserSettings.rehydrate({
    userId: row.userId,
    language: row.language,
    notifyOnComment: row.notifyOnComment,
    notifyOnStatusChange: row.notifyOnStatusChange,
  });
}

@Injectable()
export class PrismaUserSettingsRepository implements UserSettingsRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findByUserId(userId: string): Promise<UserSettings | null> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    return row === null ? null : toUserSettings(row);
  }

  public async save(settings: UserSettings): Promise<UserSettings> {
    const state = settings.snapshot();
    const columns = {
      language: state.language,
      notifyOnComment: state.notifyOnComment,
      notifyOnStatusChange: state.notifyOnStatusChange,
    };

    const row = await this.prisma.userSettings.upsert({
      where: { userId: state.userId },
      create: { userId: state.userId, ...columns },
      update: columns,
    });

    return toUserSettings(row);
  }
}
