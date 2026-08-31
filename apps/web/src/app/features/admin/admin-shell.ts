import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'fh-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  protected readonly bootstrap = inject(BootstrapStore);
}
