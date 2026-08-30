import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A category or a status, shown the only way we safely can.
 *
 * The colour is data: an admin picks it at runtime (R-43, R-44) and we cannot
 * know it, so we cannot know its contrast either. Putting the name on top of it
 * would be a bet we lose for every dark colour in light mode and every pale one
 * in dark mode.
 *
 * So the colour never carries text. It appears as a solid dot and as a wash
 * behind the chip, mixed down against the current surface with `color-mix`, and
 * the name is written in a neutral we control. Contrast is then ours in both
 * themes whatever anybody types.
 *
 * The name is always present, so colour is never the only signal (R-111). A
 * retired one says so, because R-45 keeps it on old requests after it has left
 * the picker.
 */
@Component({
  selector: 'fh-taxonomy-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip" [style.--chip]="color()">
      <span class="dot" aria-hidden="true"></span>
      <span>{{ name() }}</span>
      @if (!isActive()) {
        <span class="retired">(retired)</span>
      }
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--fh-space-2);
      padding: var(--fh-space-1) var(--fh-space-3);
      border-radius: var(--fh-radius-full);
      font-size: var(--fh-text-xs);
      font-weight: var(--fh-weight-medium);
      line-height: var(--fh-leading-normal);
      white-space: nowrap;

      /* The admin's colour, mixed down against whatever surface this sits on.
         --fh-chip-wash differs per theme because a wash that reads on white is
         invisible on near-black. */
      background: color-mix(
        in srgb,
        var(--chip) calc(var(--fh-chip-wash) * 100%),
        var(--fh-surface)
      );
      color: var(--fh-text);
      border: 1px solid color-mix(in srgb, var(--chip) 35%, transparent);
    }

    .dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: var(--fh-radius-full);
      background: var(--chip);
      /* A ring, so a colour close to the surface is still a visible disc. */
      box-shadow: 0 0 0 1px var(--fh-chip-dot-ring);
      flex: none;
    }

    .retired {
      /* Not --fh-text-subtle. That token is measured against --fh-surface, and
       * this word does not sit on --fh-surface: it sits on the chip's wash,
       * which is the admin's own colour mixed into the surface and therefore
       * darker (or lighter) by an amount nobody can know in advance. An axe
       * pass on the board caught it at 4.2:1 on the seeded grey category.
       *
       * The full text colour is the only value that is safe for every colour an
       * admin might pick, and nothing is lost: "(retired)" is already set apart
       * by the brackets and by the lighter weight, so the colour was never
       * carrying the meaning (R-111). */
      color: var(--fh-text);
      font-weight: var(--fh-weight-normal);
    }
  `,
})
export class TaxonomyChip {
  public readonly name = input.required<string>();
  public readonly color = input.required<string>();
  public readonly isActive = input<boolean>(true);
}
