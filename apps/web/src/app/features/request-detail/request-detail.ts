import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RequestDetailStore } from './request-detail.store';
import { CommentsStore } from './comments.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { TaxonomyChip } from '../../shared/ui/chip/taxonomy-chip';
import { EmptyPanel, ErrorPanel, SkeletonRows } from '../../shared/ui/state/state-panels';

/**
 * One request, its vote, and its thread (R-26 to R-42).
 *
 * The request and the comments load and fail independently, because SRS 15.2
 * asks for exactly that: "comments failed but the request loaded -> error only
 * in the comments part; the rest of the page still works."
 */
@Component({
  selector: 'fh-request-detail',
  imports: [RouterLink, DatePipe, TaxonomyChip, EmptyPanel, ErrorPanel, SkeletonRows],
  providers: [RequestDetailStore, CommentsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (detail.state()) {
      @case ('loading') {
        <fh-skeleton-rows [count]="1" label="Loading the request" />
      }

      @case ('missing') {
        <fh-empty-panel
          heading="This request does not exist any more"
          detail="It may have been deleted while you were reading it."
        >
          <a routerLink="/" class="text-accent underline">Back to the board</a>
        </fh-empty-panel>
      }

      @case ('failed') {
        <fh-error-panel
          heading="We could not load this request"
          [detail]="
            detail.error()?.isRetryable
              ? 'The server did not answer. This is usually temporary.'
              : 'Something went wrong.'
          "
          [requestId]="detail.error()?.requestId ?? ''"
          [canRetry]="detail.error()?.isRetryable ?? false"
          (retry)="detail.load(id())"
        />
      }

      @case ('ready') {
        @if (detail.request(); as request) {
          <article>
            <div class="flex items-start gap-6">
              <!--
                R-31: a real button, keyboard operable, and its name says the
                count and whether you voted. "Vote" alone would tell a
                screen-reader user nothing about what pressing it just did.
              -->
              <button
                type="button"
                class="border-line-control hover:bg-surface-hover flex h-20 w-20 flex-none flex-col items-center justify-center rounded-lg border transition-colors"
                [class.border-accent]="detail.viewerHasVoted()"
                [class.text-accent]="detail.viewerHasVoted()"
                [attr.aria-pressed]="detail.viewerHasVoted()"
                [attr.aria-label]="voteLabel()"
                (click)="detail.vote()"
              >
                <span aria-hidden="true" class="text-2xl font-semibold">
                  {{ detail.voteCount() }}
                </span>
                <span aria-hidden="true" class="text-xs">votes</span>
              </button>

              <div class="min-w-0 flex-1">
                <h1 class="text-2xl">{{ request.title }}</h1>

                <div class="mt-3 flex flex-wrap items-center gap-2">
                  @if (status(); as row) {
                    <fh-taxonomy-chip
                      [name]="row.name"
                      [color]="row.color"
                      [isActive]="row.isActive"
                    />
                  }
                  @if (category(); as row) {
                    <fh-taxonomy-chip
                      [name]="row.name"
                      [color]="row.color"
                      [isActive]="row.isActive"
                    />
                  }
                </div>

                <p class="text-subtle mt-3 text-sm">
                  {{ request.authorName }} ·
                  <time [attr.datetime]="request.createdAt">
                    {{ request.createdAt | date: 'medium' }}
                  </time>
                </p>
              </div>
            </div>

            <!-- R-98: plain text. Line breaks are kept, nothing is read as
                 HTML, which removes a whole family of attacks in one line. -->
            <p data-user-text class="mt-6 max-w-(--fh-measure)">{{ request.description }}</p>

            @if (detail.voteError(); as failure) {
              <p
                role="alert"
                class="border-danger-line bg-danger-subtle mt-4 rounded border px-4 py-3"
              >
                @if (failure.retryAt; as retryAt) {
                  You have voted too many times. You can vote again at
                  {{ retryAt | date: 'shortTime' }}.
                } @else {
                  We could not save your vote. It has been put back as it was.
                }
              </p>
            }
          </article>

          <!-- R-42: with the switch off, the box and the whole thread are gone.
               Not hidden with CSS — not rendered, and not even requested. The
               server refuses a comment as well; both halves, never one. -->
          @if (bootstrap.commentsEnabled()) {
            <section class="mt-10" aria-labelledby="comments-heading">
              <h2 id="comments-heading" class="text-xl">
                Comments
                @if (comments.total() > 0) {
                  <span class="text-muted font-normal">({{ comments.total() }})</span>
                }
              </h2>

              <form class="mt-4" (submit)="submitComment($event)">
                <label for="comment-body" class="mb-1 block text-sm font-medium">
                  Add a comment
                </label>
                <textarea
                  id="comment-body"
                  rows="3"
                  maxlength="2000"
                  [value]="comments.draft()"
                  (input)="onDraft($event)"
                  class="border-line-control bg-surface w-full rounded border p-3"
                ></textarea>

                @if (comments.addError()) {
                  <p role="alert" class="text-danger mt-2 text-sm">
                    We could not save your comment. What you wrote is still here — try again.
                  </p>
                }

                <button
                  type="submit"
                  class="bg-accent text-on-accent mt-2 min-h-11 rounded px-4 font-medium disabled:opacity-50"
                  [disabled]="comments.draft().trim().length === 0 || comments.isSaving()"
                >
                  Add comment
                </button>
              </form>

              <div class="mt-6">
                @switch (comments.state()) {
                  @case ('loading') {
                    <fh-skeleton-rows [count]="3" label="Loading comments" />
                  }
                  @case ('empty') {
                    <fh-empty-panel
                      heading="No comments yet"
                      detail="Start the discussion."
                    />
                  }
                  @case ('failed') {
                    <fh-error-panel
                      heading="We could not load the comments"
                      detail="The request above is fine — only the discussion failed to load."
                      [requestId]="comments.error()?.requestId ?? ''"
                      [canRetry]="comments.error()?.isRetryable ?? false"
                      (retry)="comments.load(id())"
                    />
                  }
                  @case ('ready') {
                    <ul aria-label="Comments" class="flex list-none flex-col gap-4 p-0">
                      @for (comment of comments.items(); track comment.id) {
                        <li class="border-line rounded-lg border p-4">
                          @if (comment.state === 'deleted') {
                            <p class="text-subtle text-sm italic">This comment was deleted.</p>
                          } @else {
                            <p class="text-subtle text-sm">
                              {{ comment.authorName }} ·
                              <time [attr.datetime]="comment.createdAt">
                                {{ comment.createdAt | date: 'medium' }}
                              </time>
                              @if (comment.state === 'pending') {
                                · <span class="text-warning">Waiting for approval</span>
                              }
                            </p>
                            <p data-user-text class="mt-2">{{ comment.body }}</p>

                            @if (comment.isMine) {
                              <button
                                type="button"
                                class="text-danger mt-2 min-h-11 text-sm underline"
                                [attr.aria-label]="'Delete comment by ' + comment.authorName"
                                (click)="comments.remove(comment.id)"
                              >
                                Delete
                              </button>
                            }
                          }
                        </li>
                      }
                    </ul>

                    @if (comments.hasMore()) {
                      <button
                        type="button"
                        class="border-line-control mt-4 min-h-11 w-full rounded border px-4"
                        (click)="comments.loadMore()"
                      >
                        Show more comments
                      </button>
                    }
                  }
                }
              </div>
            </section>
          }
        }
      }
    }
  `,
})
export class RequestDetail {
  protected readonly detail = inject(RequestDetailStore);
  protected readonly comments = inject(CommentsStore);
  protected readonly bootstrap = inject(BootstrapStore);

  /** Bound from the route by withComponentInputBinding(). */
  public readonly id = input.required<string>();

  protected readonly status = computed(() =>
    this.bootstrap.statusById(this.detail.request()?.statusId ?? ''),
  );
  protected readonly category = computed(() =>
    this.bootstrap.categoryById(this.detail.request()?.categoryId ?? ''),
  );

  /**
   * R-31: the name carries the state, not just the action. A screen reader
   * reading "12 votes. You voted. Take your vote back." after a press knows
   * exactly what happened; "Vote" would not.
   */
  protected readonly voteLabel = computed(() => {
    const count = this.detail.voteCount();
    const votes = `${count} ${count === 1 ? 'vote' : 'votes'}`;

    return this.detail.viewerHasVoted()
      ? `${votes}. You voted. Take your vote back.`
      : `${votes}. Vote for this request.`;
  });

  public constructor() {
    effect(() => {
      const id = this.id();
      void this.detail.load(id);

      // R-42: with comments off there is no thread to fetch. Asking anyway
      // would be a request whose answer we would throw away.
      if (this.bootstrap.commentsEnabled()) {
        void this.comments.load(id);
      }
    });
  }

  protected onDraft(event: Event): void {
    this.comments.setDraft((event.target as HTMLTextAreaElement).value);
  }

  protected submitComment(event: Event): void {
    event.preventDefault();
    void this.comments.add();
  }
}
