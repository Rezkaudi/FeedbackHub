/**
 * What the taxonomy module promises other modules (R-141).
 *
 * Plain data, not entities. An entity is this module's internal shape and may
 * grow methods and invariants that mean nothing outside it; a contract is what
 * we agree not to break. The dependency check enforces the difference: nothing
 * outside can import an entity at all.
 */
export interface CategoryView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly color: string;
  readonly isActive: boolean;
}

export interface StatusView extends CategoryView {
  readonly isDefault: boolean;
}
