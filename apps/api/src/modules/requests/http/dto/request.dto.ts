import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { BoardRow, SORTS } from '../../domain/entity/board-query';

/**
 * R-10: the person picks a title, a description and a category. Nothing else.
 *
 * There is deliberately no `statusId`, no `authorId`, no `isPinned` and no
 * `voteCount` here. With the global pipe refusing unknown fields, a browser that
 * sends one is answered 400 — which is the case SRS part 17 names: "given a
 * browser that also sends a status or a vote count, those extra fields are
 * refused and the server's own values are used."
 */
export class CreateRequestDto {
  @ApiProperty({ minLength: 5, maxLength: 120 })
  @IsString()
  @Length(5, 120)
  public readonly title!: string;

  @ApiProperty({ minLength: 10, maxLength: 5000 })
  @IsString()
  @Length(10, 5000)
  public readonly description!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public readonly categoryId!: string;
}

export class UpdateRequestDto {
  @ApiPropertyOptional({ minLength: 5, maxLength: 120 })
  @IsOptional() @IsString() @Length(5, 120)
  public readonly title?: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 5000 })
  @IsOptional() @IsString() @Length(10, 5000)
  public readonly description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID()
  public readonly categoryId?: string;
}

/** R-64: admin only, and the only way a status ever changes. */
export class ChangeStatusDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public readonly statusId!: string;
}

export class PinRequestDto {
  @ApiProperty()
  @IsBoolean()
  public readonly pinned!: boolean;
}

/** A query string carries "true"/"false" as text; turn the true-ish ones on. */
const toBool = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true' || value === '1';

/** A query string sends one value or many; both must become an array. */
const toArray = ({ value }: { value: unknown }): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return typeof value === 'string' && value.length > 0 ? [value] : [];
};

export class BoardQueryDto {
  @ApiPropertyOptional({ description: 'Words to look for in the title and description (R-17).' })
  @IsOptional() @IsString() @Length(1, 200)
  public readonly search?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional() @Transform(toArray) @IsArray() @IsUUID('4', { each: true })
  public readonly statusIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional() @Transform(toArray) @IsArray() @IsUUID('4', { each: true })
  public readonly categoryIds?: string[];

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Only the requests written by the person asking.',
  })
  @IsOptional() @Transform(toBool) @IsBoolean()
  public readonly mine?: boolean;

  /**
   * R-20: only these four names are accepted. Anything else is refused here,
   * before it can reach a query.
   */
  @ApiPropertyOptional({ enum: SORTS })
  @IsOptional() @IsIn(SORTS)
  public readonly sort?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  public readonly page?: number;

  /**
   * R-21: 20 per page by default. D-04 deliberately set no maximum, so a script
   * can read the whole board in one call; SCOPE.md §2 records that a very large
   * request is therefore possible.
   */
  @ApiPropertyOptional({ minimum: 1, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  public readonly pageSize?: number;
}

/** R-77: only the fields we mean to send. R-99: of the author, name and picture. */
export class RequestResponse {
  @ApiProperty() public readonly id!: string;
  @ApiProperty() public readonly title!: string;
  @ApiProperty() public readonly description!: string;
  @ApiProperty() public readonly categoryId!: string;
  @ApiProperty() public readonly statusId!: string;
  @ApiProperty() public readonly authorName!: string;
  @ApiProperty({ nullable: true, type: String }) public readonly authorAvatarUrl!: string | null;
  @ApiProperty() public readonly isPinned!: boolean;
  @ApiProperty() public readonly createdAt!: string;
  @ApiProperty({ description: 'Changes only when the text changes, never on a vote or a comment.' })
  public readonly updatedAt!: string;
  @ApiProperty({ description: 'Counted from the real votes on every read (R-28).' })
  public readonly voteCount!: number;
  @ApiProperty({ description: 'Counted for the person asking (R-33c). Zero when comments are off.' })
  public readonly commentCount!: number;
  @ApiProperty() public readonly viewerHasVoted!: boolean;
  @ApiProperty({
    description:
      'Whether the person asking wrote this. The only thing a screen needs in ' +
      'order to offer Edit and Delete (R-13, R-14); the server still decides.',
  })
  public readonly isMine!: boolean;

  public static from(row: BoardRow, viewerId: string): RequestResponse {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      categoryId: row.categoryId,
      statusId: row.statusId,
      // The author's id and email are not sent: a name and a picture are all a
      // screen needs, and an email is private (R-99). `isMine` below answers the
      // one question a screen actually has about the author, without handing
      // over an id it could then use to ask about somebody else (R-94).
      authorName: row.authorName,
      authorAvatarUrl: row.authorAvatarUrl,
      isPinned: row.isPinned,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      voteCount: row.voteCount,
      commentCount: row.commentCount,
      viewerHasVoted: row.viewerHasVoted,
      isMine: row.authorId === viewerId,
    };
  }
}

export class BoardResponse {
  @ApiProperty({ type: [RequestResponse] }) public readonly items!: RequestResponse[];
  @ApiProperty() public readonly total!: number;
  @ApiProperty() public readonly page!: number;
  @ApiProperty() public readonly pageSize!: number;
}
