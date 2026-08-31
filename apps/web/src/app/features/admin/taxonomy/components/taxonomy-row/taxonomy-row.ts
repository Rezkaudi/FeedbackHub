import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { TaxonomyChip } from '../../../../../shared/ui/chip/taxonomy-chip';
import { IconButton } from '../../../../../shared/ui/icon-button/icon-button';
import type { AdminCategory, AdminStatus } from '../../../admin.store';

@Component({
  selector: 'fh-taxonomy-row',
  imports: [TranslatePipe, TaxonomyChip, IconButton],
  templateUrl: './taxonomy-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomyRow {
  public readonly item = input.required<AdminCategory | AdminStatus>();
  public readonly isDefaultStatus = input<boolean>(false);
  public readonly canMakeDefault = input<boolean>(false);

  public readonly retired = output<void>();
  public readonly restored = output<void>();
  public readonly deleted = output<void>();
  public readonly madeDefault = output<void>();
}
