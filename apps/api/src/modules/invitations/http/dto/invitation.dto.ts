import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';
import { Invitation } from '../../domain/entity/invitation';

export class CreateInvitationDto {
  @ApiProperty({ example: 'colleague@example.com' })
  @IsEmail()
  @MaxLength(254)
  public readonly email!: string;
}

export class InvitationResponse {
  @ApiProperty() public readonly id!: string;
  @ApiProperty() public readonly email!: string;
  @ApiProperty({ nullable: true, type: String, description: 'When this address first signed in.' })
  public readonly acceptedAt!: string | null;
  @ApiProperty() public readonly createdAt!: string;

  public static from(invitation: Invitation): InvitationResponse {
    const state = invitation.snapshot();
    return {
      id: state.id,
      email: state.email,
      acceptedAt: state.acceptedAt?.toISOString() ?? null,
      createdAt: state.createdAt.toISOString(),
    };
  }
}
