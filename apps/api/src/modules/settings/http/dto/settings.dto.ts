import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
} from 'class-validator';
import { AppSettings } from '../../domain/entity/app-settings';
import { UserSettings } from '../../domain/entity/user-settings';

/**
 * R-60 lives in what these classes *do not* contain.
 *
 * UpdateMySettingsDto has no `theme`, no `defaultSort`, no `defaultFilters` and
 * no admin field. Because the global pipe refuses unknown fields, a body that
 * tries to set one is answered with 400 and a message — refused, not quietly
 * ignored, which is exactly what R-60 asks for.
 */

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export class UpdateAppSettingsDto {
  @ApiPropertyOptional({ enum: ['open', 'invite_only', 'domain_restricted'] })
  @IsOptional()
  @IsIn(['open', 'invite_only', 'domain_restricted'])
  public readonly registrationPolicy?: 'open' | 'invite_only' | 'domain_restricted';

  @ApiPropertyOptional({ type: [String], example: ['example.com'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(DOMAIN, { each: true, message: 'each domain must look like example.com' })
  public readonly allowedEmailDomains?: string[];

  @ApiPropertyOptional({ description: 'R-40. New comments wait for an admin.' })
  @IsOptional()
  @IsBoolean()
  public readonly commentsRequireApproval?: boolean;

  @ApiPropertyOptional({ description: 'R-42. The one feature switch.' })
  @IsOptional()
  @IsBoolean()
  public readonly featureCommentsEnabled?: boolean;

  // R-130: every limit is 1 or more. The upper bounds keep a typo from turning
  // a limit into "no limit at all" (R-95 asks for a biggest value on every number).
  @ApiPropertyOptional({ minimum: 1, maximum: 100000 })
  @IsOptional() @IsInt() @Min(1) @Max(100000)
  public readonly signupLimitCount?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10080 })
  @IsOptional() @IsInt() @Min(1) @Max(10080)
  public readonly signupLimitMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100000 })
  @IsOptional() @IsInt() @Min(1) @Max(100000)
  public readonly submissionLimitCount?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10080 })
  @IsOptional() @IsInt() @Min(1) @Max(10080)
  public readonly submissionLimitMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100000 })
  @IsOptional() @IsInt() @Min(1) @Max(100000)
  public readonly voteLimitCount?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10080 })
  @IsOptional() @IsInt() @Min(1) @Max(10080)
  public readonly voteLimitMinutes?: number;
}

export class UpdateMySettingsDto {
  @ApiPropertyOptional({ enum: ['en', 'ar'], nullable: true, description: 'null clears the choice.' })
  @IsOptional()
  @IsIn(['en', 'ar', null])
  public readonly language?: 'en' | 'ar' | null;

  @ApiPropertyOptional({ description: 'Email me when someone comments on my request (R-59).' })
  @IsOptional()
  @IsBoolean()
  public readonly notifyOnComment?: boolean;

  @ApiPropertyOptional({ description: 'Email me when my request changes status (R-59).' })
  @IsOptional()
  @IsBoolean()
  public readonly notifyOnStatusChange?: boolean;
}

export class AppSettingsResponse {
  @ApiProperty({ enum: ['open', 'invite_only', 'domain_restricted'] })
  public readonly registrationPolicy!: string;
  @ApiProperty({ type: [String] }) public readonly allowedEmailDomains!: readonly string[];
  @ApiProperty() public readonly commentsRequireApproval!: boolean;
  @ApiProperty() public readonly featureCommentsEnabled!: boolean;
  @ApiProperty() public readonly signupLimitCount!: number;
  @ApiProperty() public readonly signupLimitMinutes!: number;
  @ApiProperty() public readonly submissionLimitCount!: number;
  @ApiProperty() public readonly submissionLimitMinutes!: number;
  @ApiProperty() public readonly voteLimitCount!: number;
  @ApiProperty() public readonly voteLimitMinutes!: number;

  public static from(settings: AppSettings): AppSettingsResponse {
    const state = settings.snapshot();
    return {
      registrationPolicy: state.registrationPolicy,
      allowedEmailDomains: state.allowedEmailDomains,
      commentsRequireApproval: state.commentsRequireApproval,
      featureCommentsEnabled: state.featureCommentsEnabled,
      signupLimitCount: state.signupLimitCount,
      signupLimitMinutes: state.signupLimitMinutes,
      submissionLimitCount: state.submissionLimitCount,
      submissionLimitMinutes: state.submissionLimitMinutes,
      voteLimitCount: state.voteLimitCount,
      voteLimitMinutes: state.voteLimitMinutes,
    };
  }
}

export class MySettingsResponse {
  @ApiProperty({ enum: ['en', 'ar'], description: 'Resolved: code default, then mine (R-51).' })
  public readonly language!: string;
  @ApiProperty() public readonly notifyOnComment!: boolean;
  @ApiProperty() public readonly notifyOnStatusChange!: boolean;

  public static from(settings: UserSettings): MySettingsResponse {
    return {
      language: settings.language,
      notifyOnComment: settings.notifyOnComment,
      notifyOnStatusChange: settings.notifyOnStatusChange,
    };
  }
}
