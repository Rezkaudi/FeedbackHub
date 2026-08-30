import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdminStore } from '../admin.store';
import { ErrorPanel, SkeletonRows } from '../../../shared/ui/state/state-panels';
import { TaxonomyChip } from '../../../shared/ui/chip/taxonomy-chip';

/**
 * Categories and statuses (R-43 to R-49). SRS part 7 asks this screen to show
 * how many requests use each one, and that number is what makes it safe to
 * use: deleting a row something uses is refused by the database (R-46), so an
 * admin who cannot see the count has no way to tell, before clicking, which of
 * delete and retire they are about to be told to do.
 *
 * So Delete is simply not offered for a row in use. The server would refuse it
 * anyway; not offering it is the kinder half of the same rule.
 */
@Component({
  selector: 'fh-taxonomy-admin',
  imports: [ErrorPanel, SkeletonRows, TaxonomyChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (admin.state()) {
      @case ('loading') {
        <fh-skeleton-rows [count]="4" label="Loading categories and statuses" />
      }
      @case ('failed') {
        <fh-error-panel
          heading="We could not load the categories and statuses"
          [requestId]="admin.error()?.requestId ?? ''"
          [canRetry]="admin.error()?.isRetryable ?? false"
          (retry)="admin.loadTaxonomy()"
        />
      }
      @case ('ready') {
        @if (admin.actionError(); as failure) {
          <p role="alert" class="border-danger-line bg-danger-subtle mb-6 rounded border px-4 py-3">
            @if (failure.status === 409) {
              <!-- SRS 15.7's three "blocked on purpose" cases all arrive as a
                   409, and the server's own message says which one. -->
              {{ failure.message }} You can retire it instead, which hides it from the picker and
              keeps it correct on the requests that already use it.
            } @else {
              That change could not be saved. Nothing has been altered.
            }
          </p>
        }

        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" class="text-lg font-semibold">Categories</h2>
          <table class="mt-3 w-full border-collapse text-start">
            <caption class="sr-only">Categories, how many requests use each, and what you can do</caption>
            <thead>
              <tr class="border-line border-b">
                <th scope="col" class="py-2 text-start font-medium">Name</th>
                <th scope="col" class="py-2 text-start font-medium">In use by</th>
                <th scope="col" class="py-2 text-start font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (category of admin.categories(); track category.id) {
                <tr class="border-line border-b">
                  <td class="py-3">
                    <fh-taxonomy-chip
                      [name]="category.name"
                      [color]="category.color"
                      [isActive]="category.isActive"
                    />
                  </td>
                  <td class="py-3">{{ category.usageCount }} requests</td>
                  <td class="py-3">
                    @if (category.isActive) {
                      <button
                        type="button"
                        class="min-h-11 px-2 underline"
                        [attr.aria-label]="'Retire ' + category.name"
                        (click)="admin.retireCategory(category.id)"
                      >
                        Retire
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="min-h-11 px-2 underline"
                        [attr.aria-label]="'Bring back ' + category.name"
                        (click)="admin.changeCategory(category.id, { isActive: true })"
                      >
                        Bring back
                      </button>
                    }
                    @if (category.usageCount === 0) {
                      <button
                        type="button"
                        class="text-danger min-h-11 px-2 underline"
                        [attr.aria-label]="'Delete ' + category.name"
                        (click)="admin.deleteCategory(category.id)"
                      >
                        Delete
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <form class="mt-4 flex flex-wrap items-end gap-3" (submit)="addCategory($event)">
            <div>
              <label for="new-category" class="mb-1 block text-sm font-medium">New category</label>
              <input
                id="new-category"
                type="text"
                maxlength="40"
                [value]="categoryName()"
                (input)="categoryName.set(value($event))"
                class="border-line-control bg-surface min-h-11 rounded border px-3"
              />
            </div>
            <div>
              <label for="new-category-colour" class="mb-1 block text-sm font-medium">Colour</label>
              <input
                id="new-category-colour"
                type="color"
                [value]="categoryColour()"
                (input)="categoryColour.set(value($event))"
                class="border-line-control h-11 w-16 rounded border"
              />
            </div>
            <button
              type="submit"
              class="bg-accent text-on-accent min-h-11 rounded px-4 font-medium disabled:opacity-50"
              [disabled]="categoryName().trim().length === 0"
            >
              Add category
            </button>
          </form>
        </section>

        <section aria-labelledby="statuses-heading" class="mt-10">
          <h2 id="statuses-heading" class="text-lg font-semibold">Statuses</h2>
          <table class="mt-3 w-full border-collapse text-start">
            <caption class="sr-only">Statuses, how many requests use each, and what you can do</caption>
            <thead>
              <tr class="border-line border-b">
                <th scope="col" class="py-2 text-start font-medium">Name</th>
                <th scope="col" class="py-2 text-start font-medium">In use by</th>
                <th scope="col" class="py-2 text-start font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (status of admin.statuses(); track status.id) {
                <tr class="border-line border-b">
                  <td class="py-3">
                    <fh-taxonomy-chip
                      [name]="status.name"
                      [color]="status.color"
                      [isActive]="status.isActive"
                    />
                    @if (status.isDefault) {
                      <span class="text-subtle ms-2 text-xs">First status</span>
                    }
                  </td>
                  <td class="py-3">{{ status.usageCount }} requests</td>
                  <td class="py-3">
                    <!-- R-48: the first status can never be retired, so the
                         button is not there to press. -->
                    @if (!status.isDefault) {
                      <button
                        type="button"
                        class="min-h-11 px-2 underline"
                        [attr.aria-label]="'Make ' + status.name + ' the first status'"
                        (click)="admin.makeDefaultStatus(status.id)"
                      >
                        Make first
                      </button>
                      @if (status.isActive) {
                        <button
                          type="button"
                          class="min-h-11 px-2 underline"
                          [attr.aria-label]="'Retire ' + status.name"
                          (click)="admin.retireStatus(status.id)"
                        >
                          Retire
                        </button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <form class="mt-4 flex flex-wrap items-end gap-3" (submit)="addStatus($event)">
            <div>
              <label for="new-status" class="mb-1 block text-sm font-medium">New status</label>
              <input
                id="new-status"
                type="text"
                maxlength="40"
                [value]="statusName()"
                (input)="statusName.set(value($event))"
                class="border-line-control bg-surface min-h-11 rounded border px-3"
              />
            </div>
            <div>
              <label for="new-status-colour" class="mb-1 block text-sm font-medium">Colour</label>
              <input
                id="new-status-colour"
                type="color"
                [value]="statusColour()"
                (input)="statusColour.set(value($event))"
                class="border-line-control h-11 w-16 rounded border"
              />
            </div>
            <button
              type="submit"
              class="bg-accent text-on-accent min-h-11 rounded px-4 font-medium disabled:opacity-50"
              [disabled]="statusName().trim().length === 0"
            >
              Add status
            </button>
          </form>
        </section>
      }
    }
  `,
})
export class TaxonomyAdmin {
  protected readonly admin = inject(AdminStore);

  protected readonly categoryName = signal('');
  protected readonly categoryColour = signal('#0369a1');
  protected readonly statusName = signal('');
  protected readonly statusColour = signal('#0369a1');

  public constructor() {
    void this.admin.loadTaxonomy();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async addCategory(event: Event): Promise<void> {
    event.preventDefault();
    if (await this.admin.addCategory(this.categoryName().trim(), this.categoryColour())) {
      this.categoryName.set('');
    }
  }

  protected async addStatus(event: Event): Promise<void> {
    event.preventDefault();
    if (await this.admin.addStatus(this.statusName().trim(), this.statusColour())) {
      this.statusName.set('');
    }
  }
}
