import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * The shared loading, empty and error panels (R-85, R-136): written once and
 * used on every screen, so the four states cannot be done three different ways
 * or quietly skipped on the screen nobody looked at twice.
 */

/**
 * R-86: while loading, the page keeps its shape — grey blocks the same size as
 * the real thing, so nothing jumps when the data lands.
 *
 * `aria-hidden`, and a single announcement beside it: a screen reader read
 * twelve grey rectangles is worse than one that says "Loading".
 */
@Component({
  selector: 'fh-skeleton-rows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p role="status" class="sr-only">{{ label() }}</p>
    <div aria-hidden="true" class="flex flex-col gap-3">
      @for (row of rows(); track row) {
        <div class="border-line bg-surface flex gap-4 rounded-lg border p-4">
          <div class="bg-surface-sunken h-11 w-12 flex-none animate-pulse rounded"></div>
          <div class="flex flex-1 flex-col gap-2">
            <div class="bg-surface-sunken h-4 w-2/3 animate-pulse rounded"></div>
            <div class="bg-surface-sunken h-3 w-1/3 animate-pulse rounded"></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SkeletonRows {
  public readonly count = input<number>(5);
  public readonly label = input<string>('Loading');
  protected rows = () => Array.from({ length: this.count() }, (_, index) => index);
}

/**
 * R-25: "No requests yet. Be the first." — the first thing a new company sees,
 * so it must not look broken. Always with the action that fixes it.
 */
@Component({
  selector: 'fh-empty-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-line flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <p class="text-lg font-medium">{{ heading() }}</p>
      @if (detail(); as text) {
        <p class="text-muted max-w-prose">{{ text }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyPanel {
  public readonly heading = input.required<string>();
  public readonly detail = input<string>('');
}

/**
 * R-87: an error says what failed, whether trying again helps, and gives the
 * button to try again. Never a raw error code or a stack.
 *
 * `role="alert"` so it is announced when it replaces a spinner (R-92, R-112).
 */
@Component({
  selector: 'fh-error-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="alert"
      class="border-danger-line bg-danger-subtle flex flex-col items-start gap-3 rounded-lg border p-6"
    >
      <p class="font-medium">{{ heading() }}</p>
      <p class="text-muted">{{ detail() }}</p>
      @if (requestId(); as id) {
        <p class="text-subtle text-sm">
          Quote this id if you ask for help: <span class="font-mono">{{ id }}</span>
        </p>
      }
      @if (canRetry()) {
        <button
          type="button"
          class="border-line-control min-h-11 rounded border px-4 font-medium"
          (click)="retry.emit()"
        >
          Try again
        </button>
      }
    </div>
  `,
})
export class ErrorPanel {
  public readonly heading = input<string>('Something went wrong');
  public readonly detail = input<string>('');
  public readonly requestId = input<string>('');
  public readonly canRetry = input<boolean>(true);
  public readonly retry = output<void>();
}
