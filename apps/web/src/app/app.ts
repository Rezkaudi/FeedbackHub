import { ChangeDetectionStrategy, Component, DOCUMENT, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BootstrapStore } from './core/bootstrap/bootstrap.store';
import { Session } from './core/auth/session';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { Button } from './shared/ui/button/button';

@Component({
  selector: 'fh-root',
  imports: [RouterOutlet, TranslatePipe, Button],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly session = inject(Session);

  public constructor() {
    // SRS 15.8: once the app comes up signed in, resume wherever `authGuard`
    // sent the person to sign in from (see `Session.signIn`/`takeReturnUrl`).
    // `takeReturnUrl` clears the stored value on first read, so this only
    // ever navigates once per stored URL, however many times `status` flips.
    effect(() => {
      if (this.bootstrap.status() === 'ready') {
        const returnUrl = this.session.takeReturnUrl();
        if (returnUrl !== null) {
          void this.router.navigateByUrl(returnUrl);
        }
      }
    });
  }

  protected async retry(): Promise<void> {
    await this.bootstrap.load();
    if (this.bootstrap.status() === 'ready') {
      this.document.defaultView?.location.reload();
    }
  }
}
