import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nStore } from '../../../../core/i18n/i18n.store';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Menu } from '../../../../shared/ui/menu/menu';
import { MenuItem } from '../../../../shared/ui/menu/menu-item';
import type { Status } from '../../../../core/bootstrap/bootstrap.store';

/**
 * The status, as the control that changes it: a chip-shaped button that opens a
 * menu of every status, with a tick on the current one. Only admins see it
 * (R-64); everyone else sees a plain `fh-taxonomy-chip`.
 */
@Component({
  selector: 'fh-status-menu',
  imports: [Icon, Menu, MenuItem],
  templateUrl: './status-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusMenu {
  private readonly i18n = inject(I18nStore);

  public readonly statuses = input.required<readonly Status[]>();
  public readonly currentId = input.required<string>();

  public readonly changed = output<string>();

  protected readonly current = computed(() =>
    this.statuses().find((status) => status.id === this.currentId()),
  );

  protected label(): string {
    return this.i18n.translate('requestDetail.changeStatusLabel', {
      name: this.current()?.name ?? '',
    });
  }

  protected pick(menu: Menu, id: string): void {
    menu.close();
    if (id !== this.currentId()) {
      this.changed.emit(id);
    }
  }
}
