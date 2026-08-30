import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/http/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { RequiresAdmin } from '../../../shared/http/route-metadata';
import {
  BoardQueryDto,
  BoardResponse,
  ChangeStatusDto,
  CreateRequestDto,
  PinRequestDto,
  RequestResponse,
  UpdateRequestDto,
} from './dto/request.dto';
import { ReadBoard } from '../application/use-case/read-board';
import { ReadRequest } from '../application/use-case/read-request';
import { SubmitRequest } from '../application/use-case/submit-request';
import { EditRequest } from '../application/use-case/edit-request';
import { DeleteRequest } from '../application/use-case/delete-request';
import { ChangeRequestStatus } from '../application/use-case/change-request-status';
import { PinRequest } from '../application/use-case/pin-request';
import { DEFAULT_PAGE_SIZE, toSort } from '../domain/entity/board-query';

/** Thin (R-139): read the request, call one use case, map to a response DTO. */
@ApiTags('requests')
@ApiUnauthorizedResponse({ description: 'Not signed in (R-6).' })
@Controller('requests')
export class RequestsController {
  public constructor(
    private readonly readBoard: ReadBoard,
    private readonly readRequest: ReadRequest,
    private readonly submitRequest: SubmitRequest,
    private readonly editRequest: EditRequest,
    private readonly deleteRequest: DeleteRequest,
    private readonly changeRequestStatus: ChangeRequestStatus,
    private readonly pinRequest: PinRequest,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The board: search, filter, sort, page (R-16 to R-25).',
    description:
      'Pinned requests come first, but only inside the chosen filter (R-23). Sort must be one ' +
      'of the four known names; anything else is refused (R-20).',
  })
  @ApiOkResponse({ type: BoardResponse })
  public async board(
    @Query() query: BoardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BoardResponse> {
    const page = await this.readBoard.execute(
      {
        search: query.search,
        statusIds: query.statusIds ?? [],
        categoryIds: query.categoryIds ?? [],
        sort: toSort(query.sort),
        page: query.page ?? 1,
        pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
      },
      user,
    );

    return {
      items: page.rows.map((row) => RequestResponse.from(row, user.id)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One request, with the same counts the board shows.' })
  @ApiOkResponse({ type: RequestResponse })
  @ApiNotFoundResponse({ description: 'Deleted while it was open, or a bad address (SRS 15.2).' })
  public async one(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestResponse> {
    return RequestResponse.from(await this.readRequest.execute(id, user), user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Write a new request (R-10 to R-12).',
    description: 'The server sets the status, the author and the time. Sending them is refused.',
  })
  @ApiOkResponse({ type: RequestResponse })
  @ApiTooManyRequestsResponse({ description: 'Over the submission limit; says when to try again.' })
  @ApiConflictResponse({ description: 'No status is marked as the first one.' })
  public async create(
    @Body() body: CreateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestResponse> {
    const created = await this.submitRequest.execute(body, user.id);
    return RequestResponse.from(await this.readRequest.execute(created.id, user), user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change my own request, or any if I am an admin (R-13).' })
  @ApiOkResponse({ type: RequestResponse })
  @ApiForbiddenResponse({ description: 'It belongs to someone else (R-13).' })
  public async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestResponse> {
    await this.editRequest.execute(id, body, user);
    return RequestResponse.from(await this.readRequest.execute(id, user), user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete my own request, or any if I am an admin (R-14).',
    description: 'Its votes and comments go with it.',
  })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiForbiddenResponse({ description: 'It belongs to someone else (R-14).' })
  public async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteRequest.execute(id, user);
  }

  @Patch(':id/status')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Change the status. Admin only (R-64).' })
  @ApiOkResponse({ type: RequestResponse })
  @ApiForbiddenResponse({ description: 'Not an admin (R-64).' })
  public async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestResponse> {
    await this.changeRequestStatus.execute(id, body.statusId, user.id);
    return RequestResponse.from(await this.readRequest.execute(id, user), user.id);
  }

  @Patch(':id/pin')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Pin or unpin. Admin only (R-65).' })
  @ApiOkResponse({ type: RequestResponse })
  @ApiForbiddenResponse({ description: 'Not an admin (R-65).' })
  public async pin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PinRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestResponse> {
    await this.pinRequest.execute(id, body.pinned);
    return RequestResponse.from(await this.readRequest.execute(id, user), user.id);
  }
}
