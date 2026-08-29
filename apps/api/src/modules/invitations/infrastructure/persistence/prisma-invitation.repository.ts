import { Injectable } from '@nestjs/common';
import { Invitation as InvitationRow } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { InvitationRepository } from '../../application/port/invitation-repository';
import { Invitation } from '../../domain/entity/invitation';

function toInvitation(row: InvitationRow): Invitation {
  return Invitation.rehydrate({
    id: row.id,
    email: row.email,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
  });
}

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async listAll(): Promise<Invitation[]> {
    const rows = await this.prisma.invitation.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toInvitation);
  }

  public async findByEmail(email: string): Promise<Invitation | null> {
    const row = await this.prisma.invitation.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row === null ? null : toInvitation(row);
  }

  public async findById(id: string): Promise<Invitation | null> {
    const row = await this.prisma.invitation.findUnique({ where: { id } });
    return row === null ? null : toInvitation(row);
  }

  public async add(invitation: Invitation): Promise<Invitation> {
    const state = invitation.snapshot();
    const row = await this.prisma.invitation.create({
      data: { id: state.id, email: state.email, acceptedAt: state.acceptedAt },
    });
    return toInvitation(row);
  }

  public async save(invitation: Invitation): Promise<Invitation> {
    const state = invitation.snapshot();
    const row = await this.prisma.invitation.update({
      where: { id: state.id },
      data: { acceptedAt: state.acceptedAt },
    });
    return toInvitation(row);
  }

  public async remove(id: string): Promise<void> {
    await this.prisma.invitation.delete({ where: { id } });
  }
}
