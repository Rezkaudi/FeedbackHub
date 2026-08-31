import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaxonomyChip } from '../../../../shared/ui/chip/taxonomy-chip';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { IconButton } from '../../../../shared/ui/icon-button/icon-button';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/i18n/localized-date.pipe';
import type { components } from '../../../../core/api/schema';
import type { Category, Status } from '../../../../core/bootstrap/bootstrap.store';

type RequestResponse = components['schemas']['RequestResponse'];

@Component({
  selector: 'fh-request-header',
  imports: [RouterLink, TaxonomyChip, Avatar, IconButton, TranslatePipe, LocalizedDatePipe],
  templateUrl: './request-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestHeader {
  public readonly request = input.required<RequestResponse>();
  public readonly status = input<Status | undefined>(undefined);
  public readonly category = input<Category | undefined>(undefined);
  public readonly canDelete = input<boolean>(false);
  public readonly deleting = input<boolean>(false);

  public readonly deleteRequested = output<void>();
}
