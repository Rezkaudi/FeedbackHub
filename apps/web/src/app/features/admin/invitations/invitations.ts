import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminStore } from '../admin.store';
import { EmptyPanel, ErrorPanel, SkeletonRows } from '../../../shared/ui/state/state-panels';

/**
 * Invitations (R-66), used when the sign-up rule is invite only.
 *
 * R-127 says a failed email is logged and dropped — there is no retry. The
 * worst case is a lost invitation nobody hears about, so the sign-up link is
 * shown next to every invitation and can be sent by hand.
 */
@Component({
  selector: 'fh-invitations',
  imports: [DatePipe, EmptyPanel, ErrorPanel, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (admin.state()) {
      @case ('loading') {
        <fh-skeleton-rows [count]="3" label="Loading invitations" />
      }
      @case ('failed') {
        <fh-error-panel
          heading="We could not load the invitations"
          [requestId]="admin.error()?.requestId ?? ''"
          [canRetry]="admin.error()?.isRetryable ?? false"
          (retry)="admin.loadInvitations()"
        />
      }
      @case ('ready') {
        <form class="flex flex-wrap items-end gap-3" (submit)="invite($event)">
          <div>
            <label for="invite-email" class="mb-1 block font-medium">Invite an address</label>
            <input
              id="invite-email"
              type="email"
              autocomplete="email"
              [value]="email()"
              (input)="email.set(value($event))"
              class="border-line-control bg-surface min-h-11 rounded border px-3"
            />
          </div>
          <button
            type="submit"
            class="bg-accent text-on-accent min-h-11 rounded px-4 font-medium disabled:opacity-50"
            [disabled]="email().trim().length === 0"
          >
            Send invitation
          </button>
        </form>

        @if (admin.actionError()) {
          <p role="alert" class="text-danger mt-3 text-sm">
            That invitation could not be sent. It may already exist.
          </p>
        }

        <div class="mt-6">
          @if (admin.invitations().length === 0) {
            <fh-empty-panel
              heading="Nobody has been invited yet"
              detail="Invite an address above and they will get a sign-up link."
            />
          } @else {
            <table class="w-full border-collapse">
              <caption class="sr-only">Invitations and whether they have been used</caption>
              <thead>
                <tr class="border-line border-b">
                  <th scope="col" class="py-2 text-start font-medium">Address</th>
                  <th scope="col" class="py-2 text-start font-medium">Used</th>
                  <th scope="col" class="py-2 text-start font-medium">Sign-up link</th>
                  <th scope="col" class="py-2 text-start font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (invitation of admin.invitations(); track invitation.id) {
                  <tr class="border-line border-b">
                    <td class="py-3">{{ invitation.email }}</td>
                    <td class="py-3">
                      @if (invitation.acceptedAt; as when) {
                        <time [attr.datetime]="when">{{ when | date: 'mediumDate' }}</time>
                      } @else {
                        Not yet
                      }
                    </td>
                    <!-- R-127: the email may have been dropped, so the link is
                         here to be sent by hand. -->
                    <td class="py-3"><code class="text-sm">/v1/auth/sign-in</code></td>
                    <td class="py-3">
                      @if (!invitation.acceptedAt) {
                        <button
                          type="button"
                          class="text-danger min-h-11 px-2 underline"
                          [attr.aria-label]="'Withdraw the invitation for ' + invitation.email"
                          (click)="admin.withdrawInvitation(invitation.id)"
                        >
                          Withdraw
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    }
  `,
})
export class Invitations {
  protected readonly admin = inject(AdminStore);
  protected readonly email = signal('');

  public constructor() {
    void this.admin.loadInvitations();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async invite(event: Event): Promise<void> {
    event.preventDefault();
    if (await this.admin.invite(this.email().trim())) {
      this.email.set('');
    }
  }
}
