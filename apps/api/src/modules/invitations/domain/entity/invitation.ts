import { ValidationFailedError } from '../../../../shared/errors/app-error';

export interface InvitationState {
  id: string;
  email: string;
  acceptedAt: Date | null;
  createdAt: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A name on a list, used only when the sign-up rule is invite-only (SRS 12.9).
 *
 * There is no expiry and no token: the invitation *is* the email address, and it
 * is matched against the address the identity provider confirms. That is why a
 * lost invitation email is survivable — the admin screen shows the sign-up link
 * beside each one, so it can be sent again by hand (R-127).
 */
export class Invitation {
  private constructor(private readonly state: InvitationState) {}

  public static create(email: string, id: string): Invitation {
    const cleaned = email.trim().toLowerCase();

    if (!EMAIL.test(cleaned) || cleaned.length > 254) {
      throw new ValidationFailedError({ email: 'MUST_BE_AN_EMAIL_ADDRESS' });
    }

    return new Invitation({ id, email: cleaned, acceptedAt: null, createdAt: new Date(0) });
  }

  public static rehydrate(state: InvitationState): Invitation {
    return new Invitation({ ...state });
  }

  public get id(): string {
    return this.state.id;
  }
  public get email(): string {
    return this.state.email;
  }
  public get acceptedAt(): Date | null {
    return this.state.acceptedAt;
  }
  public get isAccepted(): boolean {
    return this.state.acceptedAt !== null;
  }

  public accept(at: Date): void {
    // Accepting twice keeps the first time: it is when they actually joined.
    this.state.acceptedAt ??= at;
  }

  public snapshot(): Readonly<InvitationState> {
    return { ...this.state };
  }
}
