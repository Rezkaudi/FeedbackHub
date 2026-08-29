import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length, ValidateIf } from 'class-validator';
import { User } from '../../domain/entity/user';

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  public readonly displayName?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'A picture URL, or null to go back to initials (R-54). No file upload.',
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @Length(1, 2048)
  public readonly avatarUrl?: string | null;
}

/**
 * R-99: another person's email or settings are never sent. This is *my* profile,
 * so my own email is mine to see — but the same class is never used to describe
 * somebody else. Authors elsewhere are sent as name and picture only.
 */
export class MyProfileResponse {
  @ApiProperty() public readonly id!: string;
  @ApiProperty() public readonly email!: string;
  @ApiProperty() public readonly displayName!: string;
  @ApiProperty({ nullable: true, type: String }) public readonly avatarUrl!: string | null;
  @ApiProperty({ enum: ['user', 'admin'] }) public readonly role!: string;

  public static from(user: User): MyProfileResponse {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }
}
