import { Injectable } from '@nestjs/common';
import { IdentityService } from '../../../identity/identity.service';
import { SettingsService } from '../../../settings/settings.service';
import { TaxonomyService } from '../../../taxonomy/taxonomy.service';
import { AuthenticatedUser } from '../../../../shared/auth/authenticated-user';
import type { CategoryView, StatusView } from '../../../taxonomy';
import type { UserView } from '../../../identity';
import type { AppSettingsView, MySettingsView } from '../../../settings';

/**
 * R-52 and hard part H-4: the browser gets everything it needs to start — who I
 * am, my language and email choices, the switches, the categories and the
 * statuses — in **one** call. A chain of calls is a bug.
 *
 * The three reads run together rather than one after another, so the call is one
 * round trip's worth of latency and not three (R-105: under about 200 ms).
 *
 * This module owns no table. It only calls the other modules' published
 * services, which is what keeps R-141 true while still answering in one call.
 */
export interface BootstrapData {
  readonly user: UserView;
  readonly settings: MySettingsView;
  readonly appSettings: AppSettingsView;
  readonly categories: readonly CategoryView[];
  readonly statuses: readonly StatusView[];
}

@Injectable()
export class ReadBootstrap {
  public constructor(
    private readonly identity: IdentityService,
    private readonly settings: SettingsService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  public async execute(viewer: AuthenticatedUser): Promise<BootstrapData> {
    const [user, userSettings, appSettings, lists] = await Promise.all([
      this.identity.findActiveUser(viewer.id),
      this.settings.settingsFor(viewer.id),
      this.settings.appSettings(),
      this.taxonomy.allLists(),
    ]);

    return {
      user,
      settings: userSettings,
      appSettings,
      // R-49: both lists come with this call, in created_at order. They are not
      // a separate call. Retired rows come too, marked, so R-45 can be kept
      // without a second one.
      categories: lists.categories,
      statuses: lists.statuses,
    };
  }
}
