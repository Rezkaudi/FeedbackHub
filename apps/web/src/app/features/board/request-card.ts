import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TaxonomyChip } from '../../shared/ui/chip/taxonomy-chip';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import type { RequestRow } from './board.store';

/**
 * One row of the board (R-16): title, category, status, who wrote it, the two
 * counts and a pin mark.
 *
 * The category and status arrive as ids, and the names come from the one
 * start-up call — including the retired ones, which is why R-45 can be kept
 * without a second request. An id we cannot name is shown as "Unknown" rather
 * than as a blank chip, because a blank chip looks like a rendering bug.
 *
 * The vote count is text here, not a button. Voting belongs to the request
 * page, where the optimistic update and its rollback live; a card that could
 * vote would need the same rollback in two places (R-150).
 */
@Component({
  selector: 'fh-request-card',
  imports: [RouterLink, DatePipe, TaxonomyChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="border-line bg-surface hover:bg-surface-hover rounded-lg border p-4 transition-colors">
      <div class="flex items-start gap-4">
        <!-- The count, not a control. aria-hidden because the accessible name
             of the link below already says it, and hearing it twice is noise. -->
        <div
          aria-hidden="true"
          class="border-line text-content flex h-14 w-14 flex-none flex-col items-center justify-center rounded border"
          [class.border-accent-line]="request().viewerHasVoted"
          [class.text-accent]="request().viewerHasVoted"
        >
          <span class="text-lg font-semibold">{{ request().voteCount }}</span>
          <span class="text-xs">votes</span>
        </div>

        <div class="min-w-0 flex-1">
          <h3 class="text-lg">
            <a [routerLink]="['/requests', request().id]" class="hover:underline">
              {{ request().title }}
            </a>
          </h3>

          <div class="mt-2 flex flex-wrap items-center gap-2">
            @if (request().isPinned) {
              <span class="bg-accent-subtle text-accent rounded-full px-3 py-1 text-xs font-medium">
                Pinned
              </span>
            }
            @if (status(); as row) {
              <fh-taxonomy-chip [name]="row.name" [color]="row.color" [isActive]="row.isActive" />
            }
            @if (category(); as row) {
              <fh-taxonomy-chip [name]="row.name" [color]="row.color" [isActive]="row.isActive" />
            }
          </div>

          <p class="text-subtle mt-2 text-sm">
            {{ request().authorName }} ·
            <time [attr.datetime]="request().createdAt">
              {{ request().createdAt | date: 'mediumDate' }}
            </time>
            @if (commentsEnabled()) {
              · {{ request().commentCount }} comments
            }
          </p>
        </div>
      </div>
    </article>
  `,
})
export class RequestCard {
  private readonly bootstrap = inject(BootstrapStore);

  public readonly request = input.required<RequestRow>();

  /** R-42: with comments off, the count disappears from the board entirely. */
  protected readonly commentsEnabled = this.bootstrap.commentsEnabled;

  protected readonly status = computed(
    () =>
      this.bootstrap.statusById(this.request().statusId) ?? {
        name: 'Unknown status',
        color: '#78716c',
        isActive: false,
      },
  );

  protected readonly category = computed(
    () =>
      this.bootstrap.categoryById(this.request().categoryId) ?? {
        name: 'Unknown category',
        color: '#78716c',
        isActive: false,
      },
  );
}
