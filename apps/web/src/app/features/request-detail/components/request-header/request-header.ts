import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaxonomyChip } from '../../../../shared/ui/chip/taxonomy-chip';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Icon } from '../../../../shared/ui/icon/icon';
import { IconButton } from '../../../../shared/ui/icon-button/icon-button';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/i18n/localized-date.pipe';
import { StatusMenu } from '../status-menu/status-menu';
import type { components } from '../../../../core/api/schema';
import type { Category, Status } from '../../../../core/bootstrap/bootstrap.store';

type RequestResponse = components['schemas']['RequestResponse'];

@Component({
  selector: 'fh-request-header',
  imports: [
    RouterLink,
    TaxonomyChip,
    Avatar,
    Icon,
    IconButton,
    TranslatePipe,
    LocalizedDatePipe,
    StatusMenu,
  ],
  templateUrl: './request-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestHeader {
  public readonly request = input.required<RequestResponse>();
  public readonly status = input<Status | undefined>(undefined);
  public readonly category = input<Category | undefined>(undefined);
  public readonly canDelete = input<boolean>(false);
  public readonly deleting = input<boolean>(false);

  /** Admin-only request controls live in the header, beside the content they change. */
  public readonly isAdmin = input<boolean>(false);
  public readonly statuses = input<readonly Status[]>([]);
  public readonly isPinned = input<boolean>(false);

  public readonly deleteRequested = output<void>();
  public readonly statusChanged = output<string>();
  public readonly pinToggled = output<boolean>();
}
