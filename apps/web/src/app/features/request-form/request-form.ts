import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  ElementRef,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, maxLength, minLength, required } from '@angular/forms/signals';
import { RequestFormStore, type RequestDraft } from './request-form.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { EmptyPanel, ErrorPanel } from '../../shared/ui/state/state-panels';

/**
 * Writing a request, and changing one (R-10 to R-14). One component for both,
 * because they are the same three fields and R-13 adds only "not the status".
 *
 * The rules live in the schema rather than the template, so every one of them
 * is testable without rendering anything, and the same limits the server
 * enforces (R-12) are written once here.
 *
 * Why the messages are ours and not the server's: the API's `fields` are filled
 * from class-validator's English sentences, which cannot be translated. The
 * server stays the authority — it refuses anything this misses — but the words
 * a person reads come from here.
 */
@Component({
  selector: 'fh-request-form',
  imports: [FormField, RouterLink, DatePipe, EmptyPanel, ErrorPanel],
  providers: [RequestFormStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (store.state()) {
      @case ('loading') {
        <p role="status">Loading the request…</p>
      }

      @case ('missing') {
        <fh-empty-panel heading="This request does not exist any more">
          <a routerLink="/" class="text-accent underline">Back to the board</a>
        </fh-empty-panel>
      }

      @case ('notAllowed') {
        <!-- SRS 15.2: a clear message, and no form. Showing the fields and
             failing on save would waste whatever they typed into them. -->
        <fh-empty-panel
          heading="You cannot edit this request"
          detail="Only the person who wrote a request, or an admin, can change it."
        >
          <a routerLink="/" class="text-accent underline">Back to the board</a>
        </fh-empty-panel>
      }

      @case ('failed') {
        <fh-error-panel
          heading="We could not load this request"
          [requestId]="store.error()?.requestId ?? ''"
          [canRetry]="store.error()?.isRetryable ?? false"
          (retry)="reload()"
        />
      }

      @case ('ready') {
        <h1 class="text-xl">{{ isEditing() ? 'Edit request' : 'New request' }}</h1>

        <form class="mt-6 flex max-w-(--fh-measure) flex-col gap-6" (submit)="save($event)" novalidate>
          <div>
            <label for="title" class="mb-1 block font-medium">Title</label>
            <input
              id="title"
              type="text"
              [formField]="f.title"
              [attr.aria-describedby]="titleError() ? 'title-error' : null"
              [attr.aria-invalid]="titleError() ? 'true' : null"
              class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
            />
            <!-- R-88: the message sits next to the field and says how to fix it,
                 and it appears when they leave the field or on save — not on
                 every key press. -->
            @if (titleError(); as message) {
              <p id="title-error" class="text-danger mt-1 text-sm">{{ message }}</p>
            }
          </div>

          <div>
            <label for="description" class="mb-1 block font-medium">Description</label>
            <textarea
              id="description"
              rows="8"
              [formField]="f.description"
              [attr.aria-describedby]="descriptionError() ? 'description-error' : null"
              [attr.aria-invalid]="descriptionError() ? 'true' : null"
              class="border-line-control bg-surface w-full rounded border p-3"
            ></textarea>
            @if (descriptionError(); as message) {
              <p id="description-error" class="text-danger mt-1 text-sm">{{ message }}</p>
            }
          </div>

          <div>
            <label for="categoryId" class="mb-1 block font-medium">Category</label>
            <select
              id="categoryId"
              [formField]="f.categoryId"
              [attr.aria-describedby]="categoryError() ? 'category-error' : null"
              class="border-line-control bg-surface min-h-11 rounded border px-3"
            >
              <option value="">Choose a category</option>
              <!-- R-45: only the active ones are offered. A retired one that
                   this request already uses is handled by the notice below. -->
              @for (category of bootstrap.activeCategories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
            </select>
            @if (categoryError(); as message) {
              <p id="category-error" class="text-danger mt-1 text-sm">{{ message }}</p>
            }
            @if (categoryWasRetired()) {
              <p class="text-warning mt-1 text-sm">
                The category this request used has been retired. Please pick another one.
              </p>
            }
          </div>

          @if (store.error(); as failure) {
            <p role="alert" class="border-danger-line bg-danger-subtle rounded border px-4 py-3">
              @if (failure.retryAt; as retryAt) {
                You have sent too many requests in the last hour. You can send another at
                {{ retryAt | date: 'shortTime' }}. Nothing you wrote has been lost.
              } @else if (failure.status === 403) {
                You are not allowed to change this request.
              } @else {
                We could not save this. What you wrote is still here — try again.
              }
            </p>
          }

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              class="bg-accent text-on-accent min-h-11 rounded px-4 font-medium disabled:opacity-50"
              [disabled]="store.isSaving()"
            >
              {{ store.isSaving() ? 'Saving…' : 'Save' }}
            </button>
            <a routerLink="/" class="min-h-11 px-2 underline">Cancel</a>

            @if (isEditing()) {
              <button
                type="button"
                class="text-danger ms-auto min-h-11 px-2 underline"
                (click)="askToDelete()"
              >
                Delete request
              </button>
            }
          </div>
        </form>

        <!--
          R-91: anything that deletes asks first, names the thing, and says what
          will be lost. Nothing that cannot be undone happens on one click.
        -->
        @if (confirmingDelete()) {
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-heading"
            class="border-danger-line bg-surface mt-6 rounded-lg border p-6"
          >
            <h2 id="confirm-heading" class="text-lg font-semibold">
              Delete “{{ store.initial()?.title }}”?
            </h2>
            <p class="text-muted mt-2">
              Its votes and all of its comments will be deleted too. This cannot be undone.
            </p>
            <div class="mt-4 flex gap-3">
              <button
                type="button"
                class="bg-danger min-h-11 rounded px-4 font-medium text-white"
                (click)="confirmDelete()"
              >
                Delete it
              </button>
              <button type="button" class="min-h-11 px-4 underline" (click)="cancelDelete()">
                Keep it
              </button>
            </div>
          </div>
        }
      }
    }
  `,
})
export class RequestForm {
  protected readonly store = inject(RequestFormStore);
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Absent for a new request, bound from the route when editing. */
  public readonly id = input<string | undefined>(undefined);

  protected readonly isEditing = computed(() => this.id() !== undefined);
  protected readonly confirmingDelete = signal(false);
  private readonly submitted = signal(false);

  protected readonly model = signal<RequestDraft>({
    title: '',
    description: '',
    categoryId: '',
  });

  /**
   * R-12, written once. The same limits the database and the DTO enforce, so a
   * person is told before the round trip rather than by it.
   */
  protected readonly f = form(this.model, (path) => {
    required(path.title, { message: 'Give the request a title.' });
    minLength(path.title, 5, { message: 'The title must be at least 5 letters.' });
    maxLength(path.title, 120, { message: 'The title must be 120 letters or fewer.' });

    required(path.description, { message: 'Describe what you are asking for.' });
    minLength(path.description, 10, {
      message: 'The description must be at least 10 letters.',
    });
    maxLength(path.description, 5000, {
      message: 'The description must be 5000 letters or fewer.',
    });

    // Deliberately not the placeholder's words. An error that repeats the
    // placeholder reads as though nothing happened when Save was pressed.
    required(path.categoryId, { message: 'Pick a category before saving.' });
  });

  /** The category this request was written under has since been retired. */
  protected readonly categoryWasRetired = computed(() => {
    const chosen = this.store.initial()?.categoryId;
    if (chosen === undefined || chosen === '') {
      return false;
    }
    return this.bootstrap.categoryById(chosen)?.isActive === false;
  });

  protected readonly titleError = this.messageFor(() => this.f.title());
  protected readonly descriptionError = this.messageFor(() => this.f.description());
  protected readonly categoryError = this.messageFor(() => this.f.categoryId());

  public constructor() {
    effect(() => {
      const id = this.id();
      if (id === undefined) {
        return;
      }

      void this.store.load(id).then(() => {
        const initial = this.store.initial();
        if (initial !== null) {
          // A retired category is not offered by the picker, so leaving it
          // selected would show a blank select. Clearing it makes the notice
          // above the only truthful state.
          const stillOffered = this.bootstrap.categoryById(initial.categoryId)?.isActive === true;
          this.model.set({ ...initial, categoryId: stillOffered ? initial.categoryId : '' });
        }
      });
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);

    if (this.f().invalid()) {
      // R-112: the cursor goes to the first bad field, so a keyboard user is
      // not left hunting for what went wrong.
      this.focusFirstInvalid();
      return;
    }

    const draft = this.model();
    const id = this.id();
    const saved = id === undefined
      ? await this.store.create(draft)
      : await this.store.update(id, draft);

    if (saved !== null) {
      // SRS 6.1 U-4: after saving, the person goes to their new request.
      void this.router.navigate(['/requests', saved.id]);
    }
  }

  protected askToDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected async confirmDelete(): Promise<void> {
    const id = this.id();
    if (id === undefined) {
      return;
    }

    if (await this.store.remove(id)) {
      void this.router.navigate(['/']);
    } else {
      // It is still there. Close the question and let the error say why.
      this.confirmingDelete.set(false);
    }
  }

  protected reload(): void {
    const id = this.id();
    if (id !== undefined) {
      void this.store.load(id);
    }
  }

  /**
   * R-88: shown when they leave the field or on save, never on every key press.
   * Telling somebody their title is too short while they are typing the second
   * letter is noise, not help.
   */
  private messageFor(field: () => { touched(): boolean; errors(): readonly { message?: string }[] }) {
    return computed(() => {
      const state = field();
      if (!state.touched() && !this.submitted()) {
        return '';
      }
      return state.errors()[0]?.message ?? '';
    });
  }

  private focusFirstInvalid(): void {
    const invalid = this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? this.host.nativeElement.querySelector<HTMLElement>('input,textarea,select'))?.focus();
  }
}
