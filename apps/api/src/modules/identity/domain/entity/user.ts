import { ValidationFailedError } from '../../../../shared/errors/app-error';

export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'deleted';

export interface UserState {
  id: string;
  externalId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  deletedAt: Date | null;
}

/** What a wiped account shows as, everywhere its writing still appears (R-61). */
export const DELETED_USER_NAME = 'Deleted user';

export class User {
  private constructor(private readonly state: UserState) {}

  public static createFromProvider(
    input: {
      externalId: string;
      email: string;
      emailVerified: boolean;
      displayName: string;
      avatarUrl?: string | null;
    },
    id: string,
  ): User {
    return new User({
      id,
      externalId: input.externalId,
      email: input.email.trim().toLowerCase(),
      emailVerified: input.emailVerified,
      displayName: normaliseDisplayName(input.displayName),
      avatarUrl: input.avatarUrl?.trim() ?? null,
      // Never an admin by accident. The first admin is made by the seed, and
      // after that only another admin can promote someone.
      role: 'user',
      status: 'active',
      createdAt: new Date(0),
      deletedAt: null,
    });
  }

  public static rehydrate(state: UserState): User {
    return new User({ ...state });
  }

  public get id(): string {
    return this.state.id;
  }
  public get externalId(): string {
    return this.state.externalId;
  }
  public get email(): string {
    return this.state.email;
  }
  public get emailVerified(): boolean {
    return this.state.emailVerified;
  }
  public get displayName(): string {
    return this.state.displayName;
  }
  public get avatarUrl(): string | null {
    return this.state.avatarUrl;
  }
  public get role(): UserRole {
    return this.state.role;
  }
  public get isAdmin(): boolean {
    return this.state.role === 'admin';
  }
  public get isActive(): boolean {
    return this.state.status === 'active';
  }

  /**
   * R-57 and the email/name we copy from Keycloak can go out of date, so they
   * are refreshed on every sign-in. The *role* is deliberately not refreshed
   * from the provider: it is ours, read from the saved row (R-7, R-8).
   */
  public refreshFromProvider(input: {
    email: string;
    emailVerified: boolean;
    displayName?: string;
  }): void {
    this.state.email = input.email.trim().toLowerCase();
    this.state.emailVerified = input.emailVerified;

    // A person who set their own display name keeps it: the provider must not
    // overwrite a choice they made here (R-54).
    if (input.displayName !== undefined && this.state.displayName === DELETED_USER_NAME) {
      this.state.displayName = normaliseDisplayName(input.displayName);
    }
  }

  /**
   * The identity provider's subject is meant to be forever, but it is not: a
   * Keycloak account deleted and remade comes back with the same verified email
   * and a brand new subject. When that happens the person is not a new sign-up —
   * they already have this record — so their old external id is replaced with
   * the new one and everything else on the row (their role above all) stays.
   * Only ever called after the new email has been checked against the old one.
   */
  public relinkExternalId(externalId: string): void {
    this.state.externalId = externalId;
  }

  /** R-54: a person sets their own display name and picture. */
  public changeProfile(changes: { displayName?: string; avatarUrl?: string | null }): void {
    if (changes.displayName !== undefined) {
      this.state.displayName = normaliseDisplayName(changes.displayName);
    }
    if (changes.avatarUrl !== undefined) {
      const trimmed = changes.avatarUrl?.trim() ?? '';
      this.state.avatarUrl = trimmed.length > 0 ? trimmed : null;
    }
  }

  /**
   * R-61: their name, picture and email are wiped, their sign-in stops working,
   * their votes go. Their requests and comments stay, shown as "Deleted user".
   *
   * The row itself must stay — a foreign key from requests and comments points
   * at it — so this wipes rather than deletes. The email is replaced instead of
   * emptied because it is unique and another person may later join with it.
   * The external id is replaced so the same provider account signing in again
   * gets a fresh record rather than walking back into a wiped one.
   */
  public wipe(at: Date): void {
    this.state.email = `deleted+${this.state.id}@invalid`;
    this.state.externalId = `deleted:${this.state.id}`;
    this.state.emailVerified = false;
    this.state.displayName = DELETED_USER_NAME;
    this.state.avatarUrl = null;
    this.state.status = 'deleted';
    this.state.deletedAt = at;
  }

  public snapshot(): Readonly<UserState> {
    return { ...this.state };
  }
}

function normaliseDisplayName(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new ValidationFailedError({ displayName: 'NAME_MUST_BE_1_TO_80_CHARACTERS' });
  }

  return trimmed;
}
