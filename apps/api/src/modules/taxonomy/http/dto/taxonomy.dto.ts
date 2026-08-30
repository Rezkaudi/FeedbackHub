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

/**
 * The admin list adds the one thing that screen needs and no other screen does:
 * how many requests use the row (SRS part 7).
 *
 * It is a separate shape rather than an optional field because only the list
 * endpoint can answer it. Making it optional on CategoryResponse would let every
 * other endpoint send `usageCount: undefined`, which reads as "nothing uses it"
 * and is a different claim from "nobody asked".
 */
export class AdminCategoryResponse extends CategoryResponse {
  @ApiProperty({
    description:
      'How many requests use it. Zero means it can be deleted; anything else ' +
      'means retiring is the only way out (R-46).',
  })
  public readonly usageCount!: number;

  public static fromWithUsage(category: Category, usageCount: number): AdminCategoryResponse {
    return { ...CategoryResponse.from(category), usageCount };
  }
}

export class AdminStatusResponse extends StatusResponse {
  @ApiProperty({ description: 'How many requests use it (SRS part 7).' })
  public readonly usageCount!: number;

  public static fromWithUsage(status: Status, usageCount: number): AdminStatusResponse {
    return { ...StatusResponse.from(status), usageCount };
  }
}

export class TaxonomyResponse {
  @ApiProperty({ type: [AdminCategoryResponse] })
  public readonly categories!: AdminCategoryResponse[];
  @ApiProperty({ type: [AdminStatusResponse] })
  public readonly statuses!: AdminStatusResponse[];
}
