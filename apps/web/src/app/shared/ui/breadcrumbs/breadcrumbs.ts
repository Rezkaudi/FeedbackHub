import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  /** Already translated by the caller. */
  readonly label: string;
  /** A router link for every step except the current page. */
  readonly link?: string | readonly unknown[];
}

/**
 * The trail from the board down to the page a person is on (UX: breadcrumb-web).
 * The last item is the current page — it is plain text with `aria-current`,
 * never a link.
 */
@Component({
  selector: 'fh-breadcrumbs',
  imports: [RouterLink],
  templateUrl: './breadcrumbs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Breadcrumbs {
  public readonly items = input.required<readonly BreadcrumbItem[]>();
  /** Localised label for the surrounding `<nav>`. */
  public readonly navLabel = input<string>('Breadcrumb');
}
