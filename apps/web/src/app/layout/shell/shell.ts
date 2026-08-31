import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeApplier } from '../../core/config/theme';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AppHeader } from '../header/app-header/app-header';
import { ConfirmDialog } from '../../shared/ui/dialog/confirm-dialog';
import { Snackbar } from '../../shared/ui/snackbar/snackbar';

@Component({
  selector: 'fh-shell',
  imports: [RouterOutlet, TranslatePipe, AppHeader, ConfirmDialog, Snackbar],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  public constructor() {
    inject(ThemeApplier);
  }
}
