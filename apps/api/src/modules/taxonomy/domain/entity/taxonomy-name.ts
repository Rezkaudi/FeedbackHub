import { ValidationFailedError } from '../../../../shared/errors/app-error';

/**
 * The naming rules shared by a category and a status (SRS 12.4, 12.5): 1 to 40
 * letters, and a slug for the web address and the filters.
 *
 * Written once rather than twice, because R-44 and R-150 both say the same
 * thing: the same job must not end up done two different ways.
 */
export function normaliseName(value: string, field = 'name'): string {
  const trimmed = value.trim();

  if (trimmed.length < 1 || trimmed.length > 40) {
    throw new ValidationFailedError({ [field]: 'NAME_MUST_BE_1_TO_40_CHARACTERS' });
  }

  return trimmed;
}

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** R-111: a colour is always shown with its text, but it still has to be a colour. */
export function normaliseColour(value: string): string {
  const trimmed = value.trim().toLowerCase();

  if (!HEX_COLOUR.test(trimmed)) {
    throw new ValidationFailedError({ color: 'COLOR_MUST_BE_A_HEX_VALUE' });
  }

  return trimmed;
}

export function toSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length < 1) {
    throw new ValidationFailedError({ name: 'NAME_MUST_CONTAIN_LETTERS_OR_NUMBERS' });
  }

  return slug.slice(0, 40);
}
