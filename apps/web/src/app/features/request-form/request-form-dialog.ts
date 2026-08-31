import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, required } from '@angular/forms/signals';
import type { components } from '../../core/api/schema';
import { RequestFormStore, type RequestDraft } from './request-form.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { I18nStore } from '../../core/i18n/i18n.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LocalizedDatePipe } from '../../core/i18n/localized-date.pipe';
import { Dialog } from '../../shared/ui/dialog/dialog';
import { Button } from '../../shared/ui/button/button';
import { Field } from '../../shared/ui/field/field';
import { EmptyPanel } from '../../shared/ui/state/empty-panel/empty-panel';
import { ErrorPanel } from '../../shared/ui/state/error-panel/error-panel';

type RequestResponse = components['schemas']['RequestResponse'];

@Component({
  selector: 'fh-request-form-dialog',
  providers: [RequestFormStore],
  imports: [FormField, Dialog, Button, Field, EmptyPanel, ErrorPanel, TranslatePipe, LocalizedDatePipe],
  templateUrl: './request-form-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestFormDialog {
  protected readonly store = inject(RequestFormStore);
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly i18n = inject(I18nStore);

  public readonly open = input.required<boolean>();
  public readonly id = input<string | undefined>(undefined);

  public readonly closed = output<void>();
  public readonly saved = output<RequestResponse>();

  protected readonly isEditing = computed(() => this.id() !== undefined);
  private readonly submitted = signal(false);

  protected readonly model = signal<RequestDraft>({ title: '', description: '', categoryId: '' });

  protected readonly f = form(this.model, (path) => {
    required(path.title, { message: this.i18n.translate('requestForm.titleRequired') });
    minLength(path.title, 5, { message: this.i18n.translate('requestForm.titleTooShort') });
    maxLength(path.title, 120, { message: this.i18n.translate('requestForm.titleTooLong') });

    required(path.description, { message: this.i18n.translate('requestForm.descriptionRequired') });
    minLength(path.description, 10, { message: this.i18n.translate('requestForm.descriptionTooShort') });
    maxLength(path.description, 5000, { message: this.i18n.translate('requestForm.descriptionTooLong') });

    required(path.categoryId, { message: this.i18n.translate('requestForm.categoryRequired') });
  });

  protected readonly categoryWasRetired = computed(() => {
    const chosen = this.store.initial()?.categoryId;
    if (chosen === undefined || chosen === '') {
      return false;
    }
    return this.bootstrap.categoryById(chosen)?.isActive === false;
  });

  protected readonly titleError = this.messageFor(() => this.f.title());
  protected readonly descriptionError = this.messageFor(() => this.f.description());
  protected readonly categoryError = this.messageFor(() => this.f.categoryId());

  public constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      this.submitted.set(false);
      const id = this.id();

      if (id === undefined) {
        this.model.set({ title: '', description: '', categoryId: '' });
        return;
      }

      void this.store.load(id).then(() => {
        const initial = this.store.initial();
        if (initial !== null) {
          const stillOffered = this.bootstrap.categoryById(initial.categoryId)?.isActive === true;
          this.model.set({ ...initial, categoryId: stillOffered ? initial.categoryId : '' });
        }
      });
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);

    if (this.f().invalid()) {
      this.focusFirstInvalid();
      return;
    }

    const draft = this.model();
    const id = this.id();
    const saved = id === undefined ? await this.store.create(draft) : await this.store.update(id, draft);

    if (saved !== null) {
      this.saved.emit(saved);
    }
  }

  protected reload(): void {
    const id = this.id();
    if (id !== undefined) {
      void this.store.load(id);
    }
  }

  private messageFor(field: () => { touched(): boolean; errors(): readonly { message?: string }[] }) {
    return computed(() => {
      const state = field();
      if (!state.touched() && !this.submitted()) {
        return '';
      }
      return state.errors()[0]?.message ?? '';
    });
  }

  private focusFirstInvalid(): void {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }
}
