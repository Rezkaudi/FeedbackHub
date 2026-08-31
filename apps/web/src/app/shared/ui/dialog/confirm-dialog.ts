import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Dialog } from './dialog';
import { ConfirmService } from './confirm.service';
import { Button } from '../button/button';

@Component({
  selector: 'fh-confirm-dialog',
  imports: [Dialog, Button],
  templateUrl: './confirm-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);

  protected cancel(): void {
    this.confirm.respond(false);
  }

  protected accept(): void {
    this.confirm.respond(true);
  }
}
