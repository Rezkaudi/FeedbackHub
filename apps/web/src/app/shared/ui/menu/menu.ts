import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ClickOutside } from '../../directives/click-outside';

@Component({
  selector: 'fh-menu',
  exportAs: 'fhMenu',
  imports: [ClickOutside],
  templateUrl: './menu.html',
  styleUrl: './menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router, { optional: true });

  public readonly align = input<'start' | 'end'>('end');

  private readonly opened = signal(false);
  public readonly open: Signal<boolean> = this.opened.asReadonly();

  public constructor() {
    this.router?.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
  }

  public toggle(): void {
    this.opened.update((value) => !value);
  }

  public close(): void {
    if (!this.opened()) {
      return;
    }
    this.opened.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveFocus(event.key === 'ArrowDown' ? 1 : -1);
    }
  }

  private moveFocus(direction: 1 | -1): void {
    const items = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
    );
    if (items.length === 0) {
      return;
    }

    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = (current + direction + items.length) % items.length;
    items[next]?.focus();
  }
}
