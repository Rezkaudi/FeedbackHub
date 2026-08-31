import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { LocalizedDatePipe } from '../../../../../core/i18n/localized-date.pipe';
import { IconButton } from '../../../../../shared/ui/icon-button/icon-button';
import type { Invitation } from '../../../admin.store';

@Component({
  selector: 'fh-invitation-table',
  imports: [TranslatePipe, LocalizedDatePipe, IconButton],
  templateUrl: './invitation-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitationTable {
  public readonly items = input.required<readonly Invitation[]>();
  public readonly withdrawn = output<Invitation>();
}
