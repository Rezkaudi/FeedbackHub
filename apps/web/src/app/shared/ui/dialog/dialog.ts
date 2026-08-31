import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { IconButton } from '../icon-button/icon-button';

@Component({
  selector: 'fh-dialog',
  imports: [IconButton],
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialog {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  public readonly open = input.required<boolean>();
  public readonly heading = input<string>('');
  public readonly labelledBy = input<string>('');
  public readonly closeLabel = input<string>('Close');
  public readonly size = input<'sm' | 'md' | 'lg'>('md');
  public readonly role = input<'dialog' | 'alertdialog'>('dialog');
  public readonly hideCloseButton = input<boolean>(false);

  public readonly closed = output<void>();

  public constructor() {
    effect(() => {
      this.open();
      this.sync();
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  private lastFocused: HTMLElement | null = null;

  private sync(): void {
    const dialog = this.host.nativeElement.querySelector<HTMLDialogElement>('dialog');
    if (dialog === null) {
      return;
    }

    if (this.open() && !dialog.open) {
      this.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!this.open() && dialog.open) {
      dialog.close();
      this.lastFocused?.focus();
      this.lastFocused = null;
    }
  }
}
