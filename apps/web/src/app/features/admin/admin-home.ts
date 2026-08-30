import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A placeholder until feature 6. Named honestly rather than left blank. */
@Component({
  selector: 'fh-admin-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl">Admin</h1>
    <p class="text-muted mt-2">The admin screens are not built yet.</p>
  `,
})
export class AdminHome {}
