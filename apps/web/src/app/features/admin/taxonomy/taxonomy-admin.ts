import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AdminStore, type AdminCategory, type AdminStatus } from '../admin.store';
import { I18nStore } from '../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ApiErrorPipe } from '../../../core/error/api-error.pipe';
import { ErrorPanel } from '../../../shared/ui/state/error-panel/error-panel';
import { SkeletonCard } from '../../../shared/ui/state/skeleton-card/skeleton-card';
import { SectionCard } from '../../../shared/ui/section-card/section-card';
import { Button } from '../../../shared/ui/button/button';
import { ConfirmService } from '../../../shared/ui/dialog/confirm.service';
import { TaxonomyRow } from './components/taxonomy-row/taxonomy-row';
import { TaxonomyDialog } from './components/taxonomy-dialog/taxonomy-dialog';

/** Which list this screen shows — set from the route's `data`. */
export type TaxonomyKind = 'categories' | 'statuses';

@Component({
  selector: 'fh-taxonomy-admin',
  imports: [
    TranslatePipe,
    ApiErrorPipe,
    ErrorPanel,
    SkeletonCard,
    SectionCard,
    Button,
    TaxonomyRow,
    TaxonomyDialog,
  ],
  templateUrl: './taxonomy-admin.html',
  styleUrl: './taxonomy-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomyAdmin {
  protected readonly admin = inject(AdminStore);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nStore);

  public readonly kind = input<TaxonomyKind>('categories');

  protected readonly isCategories = computed(() => this.kind() === 'categories');

  protected readonly text = computed(() =>
    this.isCategories()
      ? {
          heading: 'admin.categories' as const,
          detail: 'admin.categoriesDetail' as const,
          icon: 'grid' as const,
          addButton: 'admin.addCategory' as const,
          addHeading: 'admin.addCategoryTitle' as const,
          nameId: 'new-category',
          colorId: 'new-category-color',
        }
      : {
          heading: 'admin.statuses' as const,
          detail: 'admin.statusesDetail' as const,
          icon: 'check-circle' as const,
          addButton: 'admin.addStatus' as const,
          addHeading: 'admin.addStatusTitle' as const,
          nameId: 'new-status',
          colorId: 'new-status-color',
        },
  );

  protected readonly adding = signal(false);

  public constructor() {
    void this.admin.loadTaxonomy();
  }

  protected create(input: { name: string; color: string }): void {
    if (this.isCategories()) {
      void this.admin.addCategory(input.name, input.color);
    } else {
      void this.admin.addStatus(input.name, input.color);
    }
    this.adding.set(false);
  }

  protected retire(item: AdminCategory | AdminStatus): void {
    if (this.isCategories()) {
      void this.confirmRetire(item, () => this.admin.retireCategory(item.id));
    } else {
      void this.confirmRetire(item, () => this.admin.retireStatus(item.id));
    }
  }

  protected restore(item: AdminCategory | AdminStatus): void {
    if (this.isCategories()) {
      void this.admin.changeCategory(item.id, { isActive: true });
    } else {
      void this.admin.changeStatus(item.id, { isActive: true });
    }
  }

  protected async remove(item: AdminCategory | AdminStatus): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('admin.deleteCategoryConfirmTitle', { name: item.name }),
      message: this.i18n.translate('admin.deleteCategoryConfirmMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    if (this.isCategories()) {
      void this.admin.deleteCategory(item.id);
    } else {
      void this.admin.deleteStatus(item.id);
    }
  }

  protected makeDefault(item: AdminStatus): void {
    void this.admin.makeDefaultStatus(item.id);
  }

  private async confirmRetire(
    item: AdminCategory | AdminStatus,
    run: () => Promise<unknown>,
  ): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('admin.retireCategoryConfirmTitle', { name: item.name }),
      message: this.i18n.translate('admin.retireCategoryConfirmMessage'),
      confirmLabel: this.i18n.translate('admin.retireConfirm'),
      tone: 'danger',
    });
    if (confirmed) {
      void run();
    }
  }
}
