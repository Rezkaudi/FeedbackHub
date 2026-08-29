import { normaliseColour, normaliseName, toSlug } from './taxonomy-name';
import {
  DefaultStatusCannotBeRetiredError,
  RetiredStatusCannotBeDefaultError,
} from '../error/taxonomy-errors';

export interface StatusState {
  id: string;
  name: string;
  slug: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}

/**
 * A status is a row, not a fixed word in the code (R-43). The admin adds,
 * renames, recolours and retires them while the app runs.
 *
 * This entity knows only what one status can decide alone. "Is this the last
 * active one?" and "un-mark the previous first status" both need the other rows
 * and belong to a use case, inside one transaction (R-47).
 */
export class Status {
  private constructor(private readonly state: StatusState) {}

  public static create(input: { name: string; color: string }, id: string): Status {
    const name = normaliseName(input.name);

    return new Status({
      id,
      name,
      slug: toSlug(name),
      color: normaliseColour(input.color),
      // Never the first status by accident. Making one the first is a separate,
      // deliberate act, because it un-marks another (R-47).
      isDefault: false,
      isActive: true,
      createdAt: new Date(0),
    });
  }

  public static rehydrate(state: StatusState): Status {
    return new Status({ ...state });
  }

  public get id(): string {
    return this.state.id;
  }
  public get name(): string {
    return this.state.name;
  }
  public get slug(): string {
    return this.state.slug;
  }
  public get color(): string {
    return this.state.color;
  }
  public get isDefault(): boolean {
    return this.state.isDefault;
  }
  public get isActive(): boolean {
    return this.state.isActive;
  }
  public get createdAt(): Date {
    return this.state.createdAt;
  }

  public rename(name: string): void {
    this.state.name = normaliseName(name);
    this.state.slug = toSlug(this.state.name);
  }

  public recolour(color: string): void {
    this.state.color = normaliseColour(color);
  }

  /** R-45: retired means gone from the picker, still correct on old requests. */
  public retire(): void {
    // R-48: otherwise nobody could write a request.
    if (this.state.isDefault) {
      throw new DefaultStatusCannotBeRetiredError();
    }
    this.state.isActive = false;
  }

  public bringBack(): void {
    this.state.isActive = true;
  }

  public makeDefault(): void {
    if (!this.state.isActive) {
      throw new RetiredStatusCannotBeDefaultError();
    }
    this.state.isDefault = true;
  }

  /** Only ever called on the *previous* first status, in the same step (R-47). */
  public standDownAsDefault(): void {
    this.state.isDefault = false;
  }

  public snapshot(): Readonly<StatusState> {
    return { ...this.state };
  }
}
