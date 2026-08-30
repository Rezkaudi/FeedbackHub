import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AdminStore } from '../admin.store';
import { ErrorPanel, SkeletonRows } from '../../../shared/ui/state/state-panels';

/**
 * Application settings (R-67 to R-70, R-130).
 *
 * The feature switch at the bottom is hard part H-5, and it is a real switch:
 * turning it off removes the comment box and the whole thread from every
 * screen, removes comment counts from the board, **and** makes the server
 * refuse a comment with a clear message. A switch that only hides a button is
 * not a feature switch.
 *
 * Every limit is checked before it is sent, because R-130 says the smallest
 * value is 1 — a zero would mean nobody can write at all.
 */
@Component({
  selector: 'fh-app-settings',
  imports: [ErrorPanel, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (admin.state()) {
      @case ('loading') {
        <fh-skeleton-rows [count]="3" label="Loading the settings" />
      }
      @case ('failed') {
        <fh-error-panel
          heading="We could not load the settings"
          [requestId]="admin.error()?.requestId ?? ''"
          [canRetry]="admin.error()?.isRetryable ?? false"
          (retry)="admin.loadSettings()"
        />
      }
      @case ('ready') {
        @if (admin.settings(); as settings) {
          @if (admin.actionError()) {
            <p role="alert" class="border-danger-line bg-danger-subtle mb-6 rounded border px-4 py-3">
              That setting could not be saved. The value shown is still the one in use.
            </p>
          }
          @if (admin.wasSaved()) {
            <p role="status" class="text-success mb-6">Saved. It is in use straight away.</p>
          }

          <section aria-labelledby="signup-heading" class="max-w-(--fh-measure)">
            <h2 id="signup-heading" class="text-lg font-semibold">Who may join</h2>

            <label for="policy" class="mt-3 mb-1 block font-medium">Sign-up rule</label>
            <select
              id="policy"
              [value]="settings.registrationPolicy"
              (change)="savePolicy($event)"
              class="border-line-control bg-surface min-h-11 rounded border px-3"
            >
              <option value="open">Open to everybody</option>
              <option value="invite_only">Invite only</option>
              <option value="domain_restricted">Only these email domains</option>
            </select>

            @if (settings.registrationPolicy === 'domain_restricted') {
              <div class="mt-3">
                <label for="domains" class="mb-1 block font-medium">Allowed domains</label>
                <input
                  id="domains"
                  type="text"
                  [value]="domains()"
                  (input)="domains.set(value($event))"
                  (blur)="saveDomains()"
                  class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
                />
                <p class="text-subtle mt-1 text-sm">
                  Separated by commas. Only a verified email address counts (R-67).
                </p>
              </div>
            }
          </section>

          <section aria-labelledby="limits-heading" class="mt-10 max-w-(--fh-measure)">
            <h2 id="limits-heading" class="text-lg font-semibold">Rate limits</h2>
            <p class="text-muted mt-1 text-sm">
              Every window slides — it is not reset on the hour. Admins are limited too: a limit is
              not a permission.
            </p>

            <div class="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label for="submissionLimitCount" class="mb-1 block font-medium">
                  New requests per person
                </label>
                <input
                  id="submissionLimitCount"
                  type="number"
                  min="1"
                  [value]="settings.submissionLimitCount"
                  (change)="saveNumber('submissionLimitCount', $event)"
                  class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
                />
              </div>
              <div>
                <label for="submissionLimitMinutes" class="mb-1 block font-medium">
                  in this many minutes
                </label>
                <input
                  id="submissionLimitMinutes"
                  type="number"
                  min="1"
                  [value]="settings.submissionLimitMinutes"
                  (change)="saveNumber('submissionLimitMinutes', $event)"
                  class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
                />
              </div>
              <div>
                <label for="voteLimitCount" class="mb-1 block font-medium">
                  Votes and un-votes per person
                </label>
                <input
                  id="voteLimitCount"
                  type="number"
                  min="1"
                  [value]="settings.voteLimitCount"
                  (change)="saveNumber('voteLimitCount', $event)"
                  class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
                />
              </div>
              <div>
                <label for="voteLimitMinutes" class="mb-1 block font-medium">
                  in this many minutes
                </label>
                <input
                  id="voteLimitMinutes"
                  type="number"
                  min="1"
                  [value]="settings.voteLimitMinutes"
                  (change)="saveNumber('voteLimitMinutes', $event)"
                  class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
                />
              </div>
              <div>
                <label for="signupLimitCount" class="mb-1 block font-medium">
                  New accounts, for the whole app
                </label>
                <input
                  id="signupLimitCount"
                  type="number"
                  min="1"
                  [value]="settings.signupLimitCount"
                  (change)="saveNumber('signupLimitCount', $event)"
                  class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
                />
              </div>
              <div>
                <label for="signupLimitMinutes" class="mb-1 block font-medium">
                  in this many minutes
                </label>
                <input
                  id="signupLimitMinutes"
                  type="number"
                  min="1"
                  [value]="settings.signupLimitMinutes"
                  (change)="saveNumber('signupLimitMinutes', $event)"
                  class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
                />
              </div>
            </div>
            @if (limitTooSmall()) {
              <p role="alert" class="text-danger mt-2 text-sm">
                A limit must be at least 1. Zero would mean nobody can write at all.
              </p>
            }
          </section>

          <section aria-labelledby="features-heading" class="mt-10 max-w-(--fh-measure)">
            <h2 id="features-heading" class="text-lg font-semibold">Comments</h2>

            <label class="mt-3 flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                [checked]="settings.commentsRequireApproval"
                (change)="saveFlag('commentsRequireApproval', $event)"
              />
              New comments wait for an admin to approve them
            </label>

            <label class="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                [checked]="settings.featureCommentsEnabled"
                (change)="saveFlag('featureCommentsEnabled', $event)"
              />
              Comments are switched on
            </label>
            <p class="text-subtle text-sm">
              Turning this off removes the comment box and the whole discussion from every request,
              removes comment counts from the board, and makes the server refuse a new comment.
              People will see it change the next time they load the app.
            </p>
          </section>
        }
      }
    }
  `,
})
export class AppSettings {
  protected readonly admin = inject(AdminStore);
  protected readonly domains = signal('');
  protected readonly limitTooSmall = signal(false);

  public constructor() {
    void this.admin.loadSettings();

    effect(() => {
      const settings = this.admin.settings();
      if (settings !== null) {
        this.domains.set(settings.allowedEmailDomains.join(', '));
      }
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected savePolicy(event: Event): void {
    const policy = this.value(event);
    if (policy === 'open' || policy === 'invite_only' || policy === 'domain_restricted') {
      void this.admin.saveSettings({ registrationPolicy: policy });
    }
  }

  protected saveDomains(): void {
    void this.admin.saveSettings({
      // R-67 keeps them in small letters; sending them any other way would be
      // refused, and lowercasing here means the admin never has to think about it.
      allowedEmailDomains: this.domains()
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter((domain) => domain.length > 0),
    });
  }

  protected saveNumber(field: string, event: Event): void {
    const parsed = Number(this.value(event));

    // R-130: the smallest value is 1. Refusing here means the person is told
    // before the round trip, and the server refuses it as well.
    if (!Number.isInteger(parsed) || parsed < 1) {
      this.limitTooSmall.set(true);
      return;
    }

    this.limitTooSmall.set(false);
    void this.admin.saveSettings({ [field]: parsed });
  }

  protected saveFlag(field: string, event: Event): void {
    void this.admin.saveSettings({ [field]: (event.target as HTMLInputElement).checked });
  }
}
