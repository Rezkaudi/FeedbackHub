import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { TaxonomyChip } from '../../../../../shared/ui/chip/taxonomy-chip';
import { Button } from '../../../../../shared/ui/button/button';
import { Icon } from '../../../../../shared/ui/icon/icon';
import type { AdminCategory, AdminStatus } from '../../../admin.store';

@Component({
  selector: 'fh-taxonomy-row',
  imports: [TranslatePipe, TaxonomyChip, Button, Icon],
  templateUrl: './taxonomy-row.html',
  styleUrl: './taxonomy-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomyRow {
  public readonly item = input.required<AdminCategory | AdminStatus>();
  /** This list has the "default" concept, so keep a column for that action. */
  public readonly hasDefault = input<boolean>(false);
  public readonly isDefaultStatus = input<boolean>(false);
  public readonly canMakeDefault = input<boolean>(false);

  public readonly retired = output<void>();
  public readonly restored = output<void>();
  public readonly deleted = output<void>();
  public readonly madeDefault = output<void>();
}
