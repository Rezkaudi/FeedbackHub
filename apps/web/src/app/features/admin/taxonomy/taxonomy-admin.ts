import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminStore, type AdminCategory, type AdminStatus } from '../admin.store';
import { I18nStore } from '../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ErrorPanel } from '../../../shared/ui/state/error-panel/error-panel';
import { SkeletonRows } from '../../../shared/ui/state/skeleton-rows/skeleton-rows';
import { SectionCard } from '../../../shared/ui/section-card/section-card';
import { ConfirmService } from '../../../shared/ui/dialog/confirm.service';
import { TaxonomyRow } from './components/taxonomy-row/taxonomy-row';
import { TaxonomyForm } from './components/taxonomy-form/taxonomy-form';

@Component({
  selector: 'fh-taxonomy-admin',
  imports: [TranslatePipe, ErrorPanel, SkeletonRows, SectionCard, TaxonomyRow, TaxonomyForm],
  templateUrl: './taxonomy-admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomyAdmin {
  protected readonly admin = inject(AdminStore);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nStore);

  public constructor() {
    void this.admin.loadTaxonomy();
  }

  protected addCategory(input: { name: string; color: string }): void {
    void this.admin.addCategory(input.name, input.color);
  }

  protected addStatus(input: { name: string; color: string }): void {
    void this.admin.addStatus(input.name, input.color);
  }

  protected async retireCategory(item: AdminCategory): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('admin.retireCategoryConfirmTitle', { name: item.name }),
      message: this.i18n.translate('admin.retireCategoryConfirmMessage'),
      confirmLabel: this.i18n.translate('admin.retireConfirm'),
      tone: 'danger',
    });
    if (confirmed) {
      void this.admin.retireCategory(item.id);
    }
  }

  protected async deleteCategory(item: AdminCategory): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('admin.deleteCategoryConfirmTitle', { name: item.name }),
      message: this.i18n.translate('admin.deleteCategoryConfirmMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      tone: 'danger',
    });
    if (confirmed) {
      void this.admin.deleteCategory(item.id);
    }
  }

  protected restoreCategory(item: AdminCategory): void {
    void this.admin.changeCategory(item.id, { isActive: true });
  }

  protected restoreStatus(item: AdminStatus): void {
    void this.admin.changeStatus(item.id, { isActive: true });
  }

  protected makeDefaultStatus(item: AdminStatus): void {
    void this.admin.makeDefaultStatus(item.id);
  }

  protected async retireStatus(item: AdminStatus): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('admin.retireCategoryConfirmTitle', { name: item.name }),
      message: this.i18n.translate('admin.retireCategoryConfirmMessage'),
      confirmLabel: this.i18n.translate('admin.retireConfirm'),
      tone: 'danger',
    });
    if (confirmed) {
      void this.admin.retireStatus(item.id);
    }
  }
}
