import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BootstrapStore } from '../core/bootstrap/bootstrap.store';
import { DevicePreferencesStore } from '../core/config/device-preferences.store';
import { ThemeApplier } from '../core/config/theme';
import { Session } from '../core/auth/session';

/**
 * The frame every signed-in screen sits inside.
 *
 * Two things here exist purely for people not using a mouse, and both are
 * required rather than nice: the skip link (R-109), which lets a keyboard user
 * jump the header instead of tabbing through it on every page, and `#main`
 * carrying `tabindex="-1"` so focus has somewhere to land after a route change
 * rather than being dropped back to the top of the document.
 */
@Component({
  selector: 'fh-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Visible only once it has focus: out of the way for everyone else, and
         the first stop for a keyboard. -->
    <a
      href="#main"
      class="bg-surface text-content focus:ring-accent sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:px-4 focus:py-2 focus:ring-2"
    >
      Skip to content
    </a>

    <header class="border-line bg-surface border-b">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
        <a routerLink="/" class="text-lg font-semibold">FeedbackHub</a>

        <nav aria-label="Main" class="flex items-center gap-1">
          <a
            routerLink="/"
            routerLinkActive="text-accent font-medium"
            [routerLinkActiveOptions]="{ exact: true }"
            ariaCurrentWhenActive="page"
            class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
          >
            Board
          </a>
          @if (bootstrap.isAdmin()) {
            <a
              routerLink="/admin"
              routerLinkActive="text-accent font-medium"
              ariaCurrentWhenActive="page"
              class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
            >
              Admin
            </a>
          }
        </nav>

        <div class="ms-auto flex items-center gap-1">
          <button
            type="button"
            class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
            [attr.aria-pressed]="preferences.theme() === 'dark'"
            (click)="toggleTheme()"
          >
            Dark mode
          </button>
          <a
            routerLink="/settings"
            routerLinkActive="text-accent font-medium"
            class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
          >
            {{ bootstrap.user()?.displayName }}
          </a>
          <button
            type="button"
            class="hover:bg-surface-hover inline-flex min-h-11 items-center rounded px-3"
            (click)="session.signOut()"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>

    <!-- tabindex -1 so focus can be moved here after a navigation (R-109). -->
    <main id="main" tabindex="-1" class="mx-auto max-w-5xl px-4 py-6">
      <router-outlet />
    </main>
  `,
})
export class Shell {
  protected readonly bootstrap = inject(BootstrapStore);
  protected readonly preferences = inject(DevicePreferencesStore);
  protected readonly session = inject(Session);

  public constructor() {
    // Constructed here rather than in a provider so the effect that mirrors the
    // theme onto <html> lives exactly as long as the signed-in app does.
    inject(ThemeApplier);
  }

  protected toggleTheme(): void {
    this.preferences.setTheme(this.preferences.theme() === 'dark' ? 'light' : 'dark');
  }
}
