import { Body, Controller, Delete, Get, HttpCode, Patch, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { CurrentUser } from '../../../shared/http/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { MyProfileResponse, UpdateMyProfileDto } from './dto/identity.dto';
import { ChangeMyProfile } from '../application/use-case/change-my-profile';
import { DeleteMyAccount } from '../application/use-case/delete-my-account';
import { ReadMyProfile } from '../application/use-case/read-my-profile';
import { clearSessionCookies } from './auth-cookies';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from '../../../shared/config/environment.token';

/** R-54, R-61, R-62. Always and only the person who is signed in (R-7). */
@ApiTags('me')
@ApiUnauthorizedResponse({ description: 'Not signed in (R-6).' })
@Controller('me')
export class ProfileController {
  public constructor(
    private readonly readMyProfile: ReadMyProfile,
    private readonly changeMyProfile: ChangeMyProfile,
    private readonly deleteMyAccount: DeleteMyAccount,
    @Inject(APP_ENVIRONMENT) private readonly environment: AppEnvironmentToken,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Who I am.' })
  @ApiOkResponse({ type: MyProfileResponse })
  public async me(@CurrentUser() user: AuthenticatedUser): Promise<MyProfileResponse> {
    return MyProfileResponse.from(await this.readMyProfile.execute(user.id));
  }

  @Patch()
  @ApiOperation({ summary: 'Change my display name or picture (R-54).' })
  @ApiOkResponse({ type: MyProfileResponse })
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateMyProfileDto,
  ): Promise<MyProfileResponse> {
    return MyProfileResponse.from(await this.changeMyProfile.execute(user.id, body));
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete my account (R-61).',
    description:
      'My name, picture and email are wiped and my votes go. My requests and comments stay, ' +
      'shown as "Deleted user". The last admin cannot do this (R-62).',
  })
  @ApiNoContentResponse({ description: 'The account was wiped and the session ended.' })
  @ApiConflictResponse({ description: 'You are the only admin (R-62).' })
  public async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    await this.deleteMyAccount.execute(user.id);

    // Their sign-in stops working, so the cookies must go with it (R-61).
    clearSessionCookies(response, this.environment);
    response.status(204).send();
  }
}
