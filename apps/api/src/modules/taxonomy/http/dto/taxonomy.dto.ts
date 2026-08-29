import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Category } from '../../domain/entity/category';
import { Status } from '../../domain/entity/status';

/**
 * R-95: everything sent in is checked against a written shape, with a smallest
 * and a biggest value on every field. The global pipe refuses unknown fields
 * outright, so a body carrying `isDefault` or `id` is rejected rather than
 * quietly ignored — that is the mass-assignment guard.
 *
 * R-77: the API sends only the fields it means to send. These response shapes
 * are built by hand from the entity, so a new column cannot leak the day it is
 * added.
 */

export class CreateCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 40, example: 'Bug' })
  @IsString()
  @Length(1, 40)
  public readonly name!: string;

  @ApiProperty({ example: '#c62828', description: 'Hex colour. Always shown with its text (R-111).' })
  @IsHexColor()
  public readonly color!: string;

  @ApiPropertyOptional({ maxLength: 200, description: 'Small help text in the picker.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  public readonly description?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 40 })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  public readonly name?: string;

  @ApiPropertyOptional({ example: '#c62828' })
  @IsOptional()
  @IsHexColor()
  public readonly color?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  public readonly description?: string;

  @ApiPropertyOptional({ description: 'Only true is accepted: retiring uses its own endpoint (R-48).' })
  @IsOptional()
  @IsBoolean()
  public readonly isActive?: boolean;
}

export class CreateStatusDto {
  @ApiProperty({ minLength: 1, maxLength: 40, example: 'Under Review' })
  @IsString()
  @Length(1, 40)
  public readonly name!: string;

  @ApiProperty({ example: '#1565c0' })
  @IsHexColor()
  public readonly color!: string;
}

export class UpdateStatusDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 40 })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  public readonly name?: string;

  @ApiPropertyOptional({ example: '#1565c0' })
  @IsOptional()
  @IsHexColor()
  public readonly color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public readonly isActive?: boolean;
}

export class CategoryResponse {
  @ApiProperty() public readonly id!: string;
  @ApiProperty() public readonly name!: string;
  @ApiProperty() public readonly slug!: string;
  @ApiProperty() public readonly color!: string;
  @ApiProperty({ nullable: true, type: String }) public readonly description!: string | null;
  @ApiProperty({ description: 'false means retired: hidden from the picker (R-45).' })
  public readonly isActive!: boolean;

  public static from(category: Category): CategoryResponse {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      color: category.color,
      description: category.description,
      isActive: category.isActive,
    };
  }
}

export class StatusResponse {
  @ApiProperty() public readonly id!: string;
  @ApiProperty() public readonly name!: string;
  @ApiProperty() public readonly slug!: string;
  @ApiProperty() public readonly color!: string;
  @ApiProperty({ description: 'The status every new request starts in (R-11).' })
  public readonly isDefault!: boolean;
  @ApiProperty() public readonly isActive!: boolean;

  public static from(status: Status): StatusResponse {
    return {
      id: status.id,
      name: status.name,
      slug: status.slug,
      color: status.color,
      isDefault: status.isDefault,
      isActive: status.isActive,
    };
  }
}

export class TaxonomyResponse {
  @ApiProperty({ type: [CategoryResponse] }) public readonly categories!: CategoryResponse[];
  @ApiProperty({ type: [StatusResponse] }) public readonly statuses!: StatusResponse[];
}
