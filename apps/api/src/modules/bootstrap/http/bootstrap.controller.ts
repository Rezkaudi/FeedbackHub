import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/http/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { BootstrapResponse } from './dto/bootstrap.dto';
import { ReadBootstrap } from '../application/use-case/read-bootstrap';

/**
 * The one call the app makes before it can draw anything (R-52, H-4).
 *
 * If this fails the front end shows an error with a Try again button, never a
 * blank page and never an endless spinner (SRS 15.8) — which is why it returns
 * everything at once: there is one thing to retry, not four.
 */
@ApiTags('bootstrap')
@ApiUnauthorizedResponse({ description: 'Not signed in (R-6).' })
@Controller('bootstrap')
export class BootstrapController {
  public constructor(private readonly readBootstrap: ReadBootstrap) {}

  @Get()
  @ApiOperation({
    summary: 'Everything the app needs to start, in one call (R-52).',
    description:
      'Who I am, my language and email choices, the feature switches, the categories and the ' +
      'statuses. A chain of calls at start-up is a bug, so this must stay one call.',
  })
  @ApiOkResponse({ type: BootstrapResponse })
  public async read(@CurrentUser() user: AuthenticatedUser): Promise<BootstrapResponse> {
    return BootstrapResponse.from(await this.readBootstrap.execute(user));
  }
}
