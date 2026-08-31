import { Injectable, inject, signal, type Signal } from '@angular/core';
import { I18nStore } from '../../../core/i18n/i18n.store';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: ConfirmTone;
}

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly tone: ConfirmTone;
}

interface PendingConfirm extends ConfirmRequest {
  readonly resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly i18n = inject(I18nStore);
  private readonly pending = signal<PendingConfirm | null>(null);

  public readonly request: Signal<ConfirmRequest | null> = this.pending.asReadonly();

  public ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pending.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? this.i18n.translate('common.delete'),
        cancelLabel: options.cancelLabel ?? this.i18n.translate('common.cancel'),
        tone: options.tone ?? 'default',
        resolve,
      });
    });
  }

  public respond(value: boolean): void {
    const current = this.pending();
    if (current === null) {
      return;
    }
    this.pending.set(null);
    current.resolve(value);
  }
}
