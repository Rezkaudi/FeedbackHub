import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { SectionCard } from '../../../../../shared/ui/section-card/section-card';
import type { AppSettings } from '../../../admin.store';

@Component({
  selector: 'fh-comments-card',
  imports: [TranslatePipe, Switch, SectionCard],
  templateUrl: './comments-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentsCard {
  public readonly settings = input.required<AppSettings>();

  public readonly enabledChanged = output<boolean>();
  public readonly approvalChanged = output<boolean>();
}
