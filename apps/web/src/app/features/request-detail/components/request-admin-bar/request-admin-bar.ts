import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Button } from '../../../../shared/ui/button/button';
import type { Status } from '../../../../core/bootstrap/bootstrap.store';

@Component({
  selector: 'fh-request-admin-bar',
  imports: [TranslatePipe, Button],
  templateUrl: './request-admin-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestAdminBar {
  public readonly statuses = input.required<readonly Status[]>();
  public readonly currentStatusId = input.required<string>();
  public readonly isPinned = input.required<boolean>();
  public readonly hasError = input<boolean>(false);

  public readonly statusChanged = output<string>();
  public readonly pinToggled = output<boolean>();

  protected onStatus(event: Event): void {
    this.statusChanged.emit((event.target as HTMLSelectElement).value);
  }
}
