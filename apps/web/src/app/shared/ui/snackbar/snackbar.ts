import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SnackbarService } from './snackbar.service';
import { IconButton } from '../icon-button/icon-button';

@Component({
  selector: 'fh-snackbar',
  imports: [IconButton],
  templateUrl: './snackbar.html',
  styleUrl: './snackbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Snackbar {
  protected readonly snackbar = inject(SnackbarService);

  protected act(): void {
    const message = this.snackbar.message();
    message?.action?.onAction();
    this.snackbar.dismiss();
  }
}
