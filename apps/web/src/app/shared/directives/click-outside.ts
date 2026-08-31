import { Directive, ElementRef, inject, output } from '@angular/core';

@Directive({
  selector: '[fhClickOutside]',
  host: {
    '(document:pointerdown)': 'onPointerDown($event)',
  },
})
export class ClickOutside {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  public readonly fhClickOutside = output<void>();

  protected onPointerDown(event: PointerEvent): void {
    const target = event.target;
    if (target instanceof Node && !this.host.nativeElement.contains(target)) {
      this.fhClickOutside.emit();
    }
  }
}
