import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fh-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-md flex-col items-start gap-4 p-6">
      <h1 class="text-xl">This page does not exist</h1>
      <p class="text-muted">The address may be wrong, or the thing it pointed at was deleted.</p>
      <a routerLink="/" class="text-accent underline">Back to the board</a>
    </main>
  `,
})
export class NotFound {}
