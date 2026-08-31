import { Injectable, signal, type Signal } from '@angular/core';

export interface SnackbarAction {
  readonly label: string;
  readonly onAction: () => void;
}

export interface SnackbarMessage {
  readonly id: number;
  readonly text: string;
  readonly action?: SnackbarAction;
}

const DISMISS_AFTER_MS = 5000;

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly current = signal<SnackbarMessage | null>(null);
  private nextId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  public readonly message: Signal<SnackbarMessage | null> = this.current.asReadonly();

  public show(text: string, action?: SnackbarAction): void {
    clearTimeout(this.timer);
    const id = ++this.nextId;
    this.current.set({ id, text, action });
    this.timer = setTimeout(() => {
      if (this.current()?.id === id) {
        this.current.set(null);
      }
    }, DISMISS_AFTER_MS);
  }

  public dismiss(): void {
    clearTimeout(this.timer);
    this.current.set(null);
  }
}
