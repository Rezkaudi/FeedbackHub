import { Invitation } from '../../domain/entity/invitation';

export interface InvitationRepository {
  listAll(): Promise<Invitation[]>;
  findByEmail(email: string): Promise<Invitation | null>;
  add(invitation: Invitation): Promise<Invitation>;
  save(invitation: Invitation): Promise<Invitation>;
  remove(id: string): Promise<void>;
  findById(id: string): Promise<Invitation | null>;
}

export const INVITATION_REPOSITORY = Symbol('InvitationRepository');
