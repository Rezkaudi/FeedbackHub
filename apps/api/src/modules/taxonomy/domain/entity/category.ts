import { normaliseColour, normaliseName, toSlug } from './taxonomy-name';

export interface CategoryState {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

/**
 * A category is a row the admin owns (R-43). Bug, Feature, Improvement and
 * Question are only a starting list.
 *
 * "This is the last active category" is not a rule this entity can keep — it
 * needs the other rows — so retiring is refused in the use case (R-48), not
 * here. What one category can decide alone lives here.
 */
export class Category {
  private constructor(private readonly state: CategoryState) {}

  public static create(
    input: { name: string; color: string; description?: string | null },
    id: string,
  ): Category {
    const name = normaliseName(input.name);

    return new Category({
      id,
      name,
      slug: toSlug(name),
      color: normaliseColour(input.color),
      description: input.description?.trim() ?? null,
      isActive: true,
      createdAt: new Date(0),
    });
  }

  public static rehydrate(state: CategoryState): Category {
    return new Category({ ...state });
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
  public get description(): string | null {
    return this.state.description;
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

  public describe(description: string | null): void {
    const trimmed = description?.trim() ?? '';
    this.state.description = trimmed.length > 0 ? trimmed : null;
  }

  /** R-45: gone from the picker, still shown correctly on old requests. */
  public retire(): void {
    this.state.isActive = false;
  }

  public bringBack(): void {
    this.state.isActive = true;
  }

  public snapshot(): Readonly<CategoryState> {
    return { ...this.state };
  }
}
