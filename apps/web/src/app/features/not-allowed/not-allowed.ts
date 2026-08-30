import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * SRS 15.7: a normal person who types an admin address is told, not silently
 * bounced to the board as though the address never existed.
 *
 * The screen is the courtesy. The refusal is the server's (R-70), and it stands
 * whether or not this page is ever shown.
 */
@Component({
  selector: 'fh-not-allowed',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-md flex-col items-start gap-4 p-6">
      <h1 class="text-xl">You cannot open this page</h1>
      <p class="text-muted">This part of FeedbackHub is for admins.</p>
      <a routerLink="/" class="text-accent underline">Back to the board</a>
    </main>
  `,
})
export class NotAllowed {}
