import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Comment } from '../../domain/entity/comment';

export class WriteCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  public readonly body!: string;
}

export class EditCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  public readonly body!: string;
}

export class ListCommentsDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  public readonly limit?: number;

  @ApiPropertyOptional({ description: 'Opaque. Give back what nextCursor said (R-33b).' })
  @IsOptional() @IsString() @Length(1, 200)
  public readonly cursor?: string;
}

/**
 * R-38: a deleted comment is a grey line. The API sends the state and an empty
 * body rather than the text, so there is nothing left for a client to show even
 * by accident.
 */
export class CommentResponse {
  @ApiProperty() public readonly id!: string;
  @ApiProperty({ description: 'Empty when the comment was deleted (R-38).' })
  public readonly body!: string;
  @ApiProperty({ enum: ['published', 'pending', 'deleted'] })
  public readonly state!: string;
  @ApiProperty() public readonly authorName!: string;
  @ApiProperty({ nullable: true, type: String }) public readonly authorAvatarUrl!: string | null;
  @ApiProperty() public readonly isMine!: boolean;
  @ApiProperty() public readonly createdAt!: string;

  public static from(
    comment: Comment,
    author: { displayName: string; avatarUrl: string | null },
    viewerId: string,
  ): CommentResponse {
    const data = comment.snapshot();
    return {
      id: data.id,
      body: data.body,
      state: data.state,
      // R-99: the author's name and picture only. Never their email or their id.
      authorName: author.displayName,
      authorAvatarUrl: author.avatarUrl,
      isMine: data.authorId === viewerId,
      createdAt: data.createdAt.toISOString(),
    };
  }
}

export class CommentPageResponse {
  @ApiProperty({ type: [CommentResponse] }) public readonly items!: CommentResponse[];
  @ApiProperty({ nullable: true, type: String, description: 'Empty means the end (R-33b).' })
  public readonly nextCursor!: string | null;
  @ApiProperty({ description: 'Counted for the person asking (R-33c).' })
  public readonly total!: number;
}
