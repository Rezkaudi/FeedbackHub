import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminStore } from '../admin.store';
import { EmptyPanel, ErrorPanel, SkeletonRows } from '../../../shared/ui/state/state-panels';

/**
 * Comments waiting for approval (R-41).
 *
 * Approve makes it appear and lets the email go (R-125); reject turns it into
 * the grey line and it is never emailed. There is no edit here, deliberately:
 * R-36 says an admin never rewrites what somebody said.
 */
@Component({
  selector: 'fh-pending-comments',
  imports: [DatePipe, EmptyPanel, ErrorPanel, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (admin.state()) {
      @case ('loading') {
        <fh-skeleton-rows [count]="3" label="Loading waiting comments" />
      }
      @case ('failed') {
        <fh-error-panel
          heading="We could not load the waiting comments"
          [requestId]="admin.error()?.requestId ?? ''"
          [canRetry]="admin.error()?.isRetryable ?? false"
          (retry)="admin.loadPending()"
        />
      }
      @case ('ready') {
        @if (admin.pending().length === 0) {
          <fh-empty-panel
            heading="Nothing is waiting"
            detail="Every comment has been dealt with."
          />
        } @else {
          <ul aria-label="Waiting comments" class="flex list-none flex-col gap-4 p-0">
            @for (comment of admin.pending(); track comment.id) {
              <li class="border-line rounded-lg border p-4">
                <p class="text-subtle text-sm">
                  {{ comment.authorName }} ·
                  <time [attr.datetime]="comment.createdAt">
                    {{ comment.createdAt | date: 'medium' }}
                  </time>
                </p>
                <p data-user-text class="mt-2">{{ comment.body }}</p>
                <div class="mt-3 flex gap-3">
                  <button
                    type="button"
                    class="bg-accent text-on-accent min-h-11 rounded px-4 font-medium"
                    [attr.aria-label]="'Approve the comment by ' + comment.authorName"
                    (click)="admin.approveComment(comment.id)"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    class="border-danger-line text-danger min-h-11 rounded border px-4"
                    [attr.aria-label]="'Reject the comment by ' + comment.authorName"
                    (click)="admin.rejectComment(comment.id)"
                  >
                    Reject
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      }
    }
  `,
})
export class PendingComments {
  protected readonly admin = inject(AdminStore);

  public constructor() {
    void this.admin.loadPending();
  }
}
