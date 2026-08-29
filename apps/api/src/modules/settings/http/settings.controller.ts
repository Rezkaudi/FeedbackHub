import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequiresAdmin } from '../../../shared/http/route-metadata';
import { CurrentUser } from '../../../shared/http/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import {
  AppSettingsResponse,
  MySettingsResponse,
  UpdateAppSettingsDto,
  UpdateMySettingsDto,
} from './dto/settings.dto';
import { ReadAppSettings } from '../application/use-case/read-app-settings';
import { ChangeAppSettings } from '../application/use-case/change-app-settings';
import { ReadUserSettings } from '../application/use-case/read-user-settings';
import { ChangeMySettings } from '../application/use-case/change-my-settings';

/**
 * Two surfaces, deliberately kept apart (R-60):
 *
 *   /v1/settings/app — admin only. The sign-up rule, the approval switch, the
 *                      feature switch and the six rate-limit numbers.
 *   /v1/settings/me  — anyone signed in, and only ever their own row. The id
 *                      comes from the guard chain, never from the body (R-7).
 *
 * Splitting them at the route is what makes "a person can never change an admin
 * setting" true by construction rather than by a check someone must remember.
 */
@ApiTags('settings')
@ApiUnauthorizedResponse({ description: 'Not signed in (R-6).' })
@Controller('settings')
export class SettingsController {
  public constructor(
    private readonly readAppSettings: ReadAppSettings,
    private readonly changeAppSettings: ChangeAppSettings,
    private readonly readUserSettings: ReadUserSettings,
    private readonly changeMySettings: ChangeMySettings,
  ) {}

  @Get('app')
  @RequiresAdmin()
  @ApiOperation({ summary: 'The application-wide settings (R-67 to R-70).' })
  @ApiOkResponse({ type: AppSettingsResponse })
  @ApiForbiddenResponse({ description: 'Not an admin (R-70).' })
  public async appSettings(): Promise<AppSettingsResponse> {
    return AppSettingsResponse.from(await this.readAppSettings.execute());
  }

  @Patch('app')
  @RequiresAdmin()
  @ApiOperation({
    summary: 'Change the application-wide settings. Takes effect with no restart (R-69).',
    description: 'A bad value leaves every setting as it was — nothing is half-saved (SRS 15.7).',
  })
  @ApiOkResponse({ type: AppSettingsResponse })
  @ApiForbiddenResponse({ description: 'Not an admin (R-70).' })
  public async updateAppSettings(
    @Body() body: UpdateAppSettingsDto,
  ): Promise<AppSettingsResponse> {
    return AppSettingsResponse.from(await this.changeAppSettings.execute(body));
  }

  @Get('me')
  @ApiOperation({ summary: 'My own settings, resolved: code default, then mine (R-51).' })
  @ApiOkResponse({ type: MySettingsResponse })
  public async mySettings(@CurrentUser() user: AuthenticatedUser): Promise<MySettingsResponse> {
    return MySettingsResponse.from(await this.readUserSettings.execute(user.id));
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Change my language or my email choices. Nothing else (R-60).',
    description:
      'Theme, default sort and default filters live in the browser and are not accepted here. ' +
      'Sending one is refused with a message, not ignored.',
  })
  @ApiOkResponse({ type: MySettingsResponse })
  @ApiBadRequestResponse({ description: 'A field that is not mine to change (R-60).' })
  public async updateMySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateMySettingsDto,
  ): Promise<MySettingsResponse> {
    return MySettingsResponse.from(await this.changeMySettings.execute(user.id, body));
  }
}
