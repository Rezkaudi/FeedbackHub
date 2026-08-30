import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A placeholder until feature 2. Named honestly rather than left blank. */
@Component({
  selector: 'fh-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl">Board</h1>
    <p class="text-muted mt-2">The request list is not built yet.</p>
  `,
})
export class Board {}
