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
} from '@nestjs/common';
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
import {
  CategoryResponse,
  CreateCategoryDto,
  CreateStatusDto,
  StatusResponse,
  TaxonomyResponse,
  UpdateCategoryDto,
  UpdateStatusDto,
} from './dto/taxonomy.dto';
import { ListTaxonomy } from '../application/use-case/list-taxonomy';
import { AddCategory } from '../application/use-case/add-category';
import { ChangeCategory } from '../application/use-case/change-category';
import { RetireCategory } from '../application/use-case/retire-category';
import { DeleteCategory } from '../application/use-case/delete-category';
import { AddStatus } from '../application/use-case/add-status';
import { ChangeStatus } from '../application/use-case/change-status';
import { RetireStatus } from '../application/use-case/retire-status';
import { DeleteStatus } from '../application/use-case/delete-status';
import { MakeStatusDefault } from '../application/use-case/make-status-default';

/**
 * The HTTP layer is thin (R-139): read the request, call one use case, map the
 * result to a response DTO. No business rule lives here.
 *
 * Everything that changes the taxonomy is admin-only (R-43, R-70). @RequiresAdmin
 * on the class means a route added later cannot forget it — and the guard reads
 * the role from the saved row, not from the token alone (R-8).
 *
 * Reading is not admin-only: everyone needs the lists to filter the board. The
 * one start-up call carries them (R-49, R-52); this endpoint exists for the
 * admin screen, which also wants the retired ones.
 */
@ApiTags('taxonomy')
@ApiUnauthorizedResponse({ description: 'Not signed in (R-6).' })
@Controller('taxonomy')
export class TaxonomyController {
  public constructor(
    private readonly listTaxonomy: ListTaxonomy,
    private readonly addCategory: AddCategory,
    private readonly changeCategory: ChangeCategory,
    private readonly retireCategory: RetireCategory,
    private readonly deleteCategory: DeleteCategory,
    private readonly addStatus: AddStatus,
    private readonly changeStatus: ChangeStatus,
    private readonly retireStatus: RetireStatus,
    private readonly deleteStatus: DeleteStatus,
    private readonly makeStatusDefault: MakeStatusDefault,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The categories and statuses an admin manages, retired ones included.',
  })
  @ApiOkResponse({ type: TaxonomyResponse })
  @RequiresAdmin()
  public async list(): Promise<TaxonomyResponse> {
    const { categories, statuses } = await this.listTaxonomy.execute({ includeRetired: true });

    return {
      categories: categories.map((category) => CategoryResponse.from(category)),
      statuses: statuses.map((status) => StatusResponse.from(status)),
    };
  }

  // -- categories ----------------------------------------------------------

  @Post('categories')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Add a category (R-44).' })
  @ApiOkResponse({ type: CategoryResponse })
  @ApiForbiddenResponse({ description: 'Not an admin (R-70).' })
  @ApiConflictResponse({ description: 'Another category already has that name (R-44).' })
  public async createCategory(@Body() body: CreateCategoryDto): Promise<CategoryResponse> {
    return CategoryResponse.from(await this.addCategory.execute(body));
  }

  @Patch('categories/:id')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Rename, recolour, or bring a retired category back.' })
  @ApiOkResponse({ type: CategoryResponse })
  public async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    return CategoryResponse.from(await this.changeCategory.execute(id, body));
  }

  @Post('categories/:id/retire')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Retire a category: gone from the picker, kept on old requests (R-45).' })
  @ApiOkResponse({ type: CategoryResponse })
  @ApiConflictResponse({ description: 'It is the last active category (R-48).' })
  public async retireOneCategory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponse> {
    return CategoryResponse.from(await this.retireCategory.execute(id));
  }

  @Delete('categories/:id')
  @RequiresAdmin()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a category that nothing uses.' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiConflictResponse({ description: 'Requests use it — retire it instead (R-46).' })
  public async removeCategory(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteCategory.execute(id);
  }

  // -- statuses ------------------------------------------------------------

  @Post('statuses')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Add a status. It never becomes the first one by itself (R-47).' })
  @ApiOkResponse({ type: StatusResponse })
  @ApiConflictResponse({ description: 'Another status already has that name (R-44).' })
  public async createStatus(@Body() body: CreateStatusDto): Promise<StatusResponse> {
    return StatusResponse.from(await this.addStatus.execute(body));
  }

  @Patch('statuses/:id')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Rename, recolour, or bring a retired status back.' })
  @ApiOkResponse({ type: StatusResponse })
  public async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStatusDto,
  ): Promise<StatusResponse> {
    return StatusResponse.from(await this.changeStatus.execute(id, body));
  }

  @Post('statuses/:id/retire')
  @RequiresAdmin()
  @ApiOperation({ summary: 'Retire a status. The first status cannot be retired (R-48).' })
  @ApiOkResponse({ type: StatusResponse })
  @ApiConflictResponse({ description: 'It is the status new requests start in (R-48).' })
  public async retireOneStatus(@Param('id', ParseUUIDPipe) id: string): Promise<StatusResponse> {
    return StatusResponse.from(await this.retireStatus.execute(id));
  }

  @Post('statuses/:id/make-default')
  @RequiresAdmin()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Make this the status new requests start in. Un-marks the old one in the same step.',
    description: 'R-47. Afterwards exactly one status is the first one — the database enforces it.',
  })
  @ApiNoContentResponse({ description: 'Done.' })
  public async setDefaultStatus(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.makeStatusDefault.execute(id);
  }

  @Delete('statuses/:id')
  @RequiresAdmin()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a status that nothing uses.' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiConflictResponse({ description: 'Requests use it — retire it instead (R-46).' })
  public async removeStatus(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteStatus.execute(id);
  }
}
