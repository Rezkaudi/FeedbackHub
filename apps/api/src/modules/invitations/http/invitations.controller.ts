import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequiresAdmin } from '../../../shared/http/route-metadata';
import { CreateInvitationDto, InvitationResponse } from './dto/invitation.dto';
import { InvitePerson } from '../application/use-case/invite-person';
import { ListInvitations } from '../application/use-case/list-invitations';
import { CancelInvitation } from '../application/use-case/cancel-invitation';

/**
 * R-66: only an admin can add, see or remove an invitation, and the server reads
 * the role from the saved row before every one. A normal person who calls this
 * by hand gets 403 — hiding the screen is not the check.
 */
@ApiTags('invitations')
@ApiUnauthorizedResponse({ description: 'Not signed in (R-6).' })
@ApiForbiddenResponse({ description: 'Not an admin (R-66).' })
@RequiresAdmin()
@Controller('invitations')
export class InvitationsController {
  public constructor(
    private readonly invitePerson: InvitePerson,
    private readonly listInvitations: ListInvitations,
    private readonly cancelInvitation: CancelInvitation,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Every invitation, and whether it has been used.' })
  @ApiOkResponse({ type: [InvitationResponse] })
  public async list(): Promise<InvitationResponse[]> {
    const invitations = await this.listInvitations.execute();
    return invitations.map((invitation) => InvitationResponse.from(invitation));
  }

  @Post()
  @ApiOperation({ summary: 'Invite an address.' })
  @ApiOkResponse({ type: InvitationResponse })
  @ApiConflictResponse({ description: 'That address has already been invited.' })
  public async create(@Body() body: CreateInvitationDto): Promise<InvitationResponse> {
    return InvitationResponse.from(await this.invitePerson.execute(body.email));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Withdraw an invitation.' })
  @ApiNoContentResponse({ description: 'Withdrawn.' })
  public async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.cancelInvitation.execute(id);
  }
}
