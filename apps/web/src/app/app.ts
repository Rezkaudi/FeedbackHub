import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BootstrapStore } from './core/bootstrap/bootstrap.store';
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

  protected async retry(): Promise<void> {
    await this.bootstrap.load();
    if (this.bootstrap.status() === 'ready') {
      this.document.defaultView?.location.reload();
    }
  }
}
