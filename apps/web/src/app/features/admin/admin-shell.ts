import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';

/**
 * The frame around the admin screens.
 *
 * Two links are conditional, and both are a courtesy only (R-70): the waiting
 * comments queue exists when approval is on, and invitations when sign-up is
 * invite only. The server refuses either endpoint to a non-admin whatever this
 * shows, and hiding a link is never the check.
 */
@Component({
  selector: 'fh-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl">Admin</h1>
    <nav aria-label="Admin sections" class="border-line mt-4 flex flex-wrap gap-1 border-b pb-2">
      <a
        routerLink="taxonomy"
        routerLinkActive="text-accent font-medium"
        ariaCurrentWhenActive="page"
        class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
      >
        Categories and statuses
      </a>
      <a
        routerLink="settings"
        routerLinkActive="text-accent font-medium"
        ariaCurrentWhenActive="page"
        class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
      >
        Application settings
      </a>
      @if (bootstrap.commentsRequireApproval()) {
        <a
          routerLink="comments"
          routerLinkActive="text-accent font-medium"
          ariaCurrentWhenActive="page"
          class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
        >
          Waiting comments
        </a>
      }
      <a
        routerLink="invitations"
        routerLinkActive="text-accent font-medium"
        ariaCurrentWhenActive="page"
        class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
      >
        Invitations
      </a>
    </nav>

    <div class="mt-6">
      <router-outlet />
    </div>
  `,
})
export class AdminShell {
  protected readonly bootstrap = inject(BootstrapStore);
}
