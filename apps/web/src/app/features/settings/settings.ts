import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsStore } from './settings.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { DevicePreferencesStore } from '../../core/config/device-preferences.store';
import { Session } from '../../core/auth/session';

/**
 * My settings (R-54 to R-62).
 *
 * The screen is arranged around where each setting actually lives, because that
 * is a real difference a person can feel: the browser section says so in as
 * many words, so nobody is surprised when their theme does not follow them to
 * their phone (SRS part 17 asks for exactly that case).
 *
 * Each part saves on its own and says "Saved" (SRS 15.6), so one failing part
 * cannot make a part that saved a moment ago look unsaved.
 */
@Component({
  selector: 'fh-settings',
  providers: [SettingsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-xl">Settings</h1>

    <div class="mt-8 flex max-w-(--fh-measure) flex-col gap-10">
      <!-- ---------------------------------------------------------------- -->
      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading" class="text-lg font-semibold">Profile</h2>
        <p class="text-muted mt-1 text-sm">Shown on your requests and comments.</p>

        <form class="mt-4 flex flex-col gap-4" (submit)="saveProfile($event)">
          <div>
            <label for="displayName" class="mb-1 block font-medium">Display name</label>
            <input
              id="displayName"
              type="text"
              maxlength="80"
              [value]="displayName()"
              (input)="displayName.set(asValue($event))"
              [attr.aria-describedby]="store.profileError() ? 'profile-error' : null"
              class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
            />
            @if (displayName().trim().length === 0) {
              <p class="text-danger mt-1 text-sm">Your display name cannot be empty.</p>
            }
          </div>

          <div>
            <label for="avatarUrl" class="mb-1 block font-medium">Picture address</label>
            <input
              id="avatarUrl"
              type="url"
              [value]="avatarUrl()"
              (input)="avatarUrl.set(asValue($event))"
              class="border-line-control bg-surface min-h-11 w-full rounded border px-3"
            />
            <!-- R-54: no picture means we draw their initials. Said here so an
                 empty box does not look like something is missing. -->
            <p class="text-subtle mt-1 text-sm">
              Leave this empty and we will draw your initials instead.
            </p>
          </div>

          @if (store.profileError()) {
            <p id="profile-error" role="alert" class="text-danger text-sm">
              We could not save your profile. What you typed is still here — try again.
            </p>
          }
          @if (store.profileSaved()) {
            <p role="status" class="text-success text-sm">Saved.</p>
          }

          <button
            type="submit"
            class="bg-accent text-on-accent min-h-11 self-start rounded px-4 font-medium disabled:opacity-50"
            [disabled]="displayName().trim().length === 0"
          >
            Save profile
          </button>
        </form>
      </section>

      <!-- ---------------------------------------------------------------- -->
      <section aria-labelledby="account-heading">
        <h2 id="account-heading" class="text-lg font-semibold">Language and email</h2>
        <p class="text-muted mt-1 text-sm">
          Kept with your account, so these follow you to any device.
        </p>

        <form class="mt-4 flex flex-col gap-4" (submit)="saveSettings($event)">
          <div>
            <label for="language" class="mb-1 block font-medium">Language</label>
            <select
              id="language"
              [value]="language()"
              (change)="language.set(asValue($event) === 'ar' ? 'ar' : 'en')"
              class="border-line-control bg-surface min-h-11 rounded border px-3"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>

          <fieldset>
            <legend class="mb-1 font-medium">Email me</legend>
            <label class="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                [checked]="notifyOnComment()"
                (change)="notifyOnComment.set(asChecked($event))"
              />
              when somebody comments on my request
            </label>
            <label class="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                [checked]="notifyOnStatusChange()"
                (change)="notifyOnStatusChange.set(asChecked($event))"
              />
              when the status of my request changes
            </label>
          </fieldset>

          @if (store.settingsError()) {
            <p role="alert" class="text-danger text-sm">
              We could not save these. Your previous choices are still in place — try again.
            </p>
          }
          @if (store.settingsSaved()) {
            <p role="status" class="text-success text-sm">Saved.</p>
          }

          <button
            type="submit"
            class="bg-accent text-on-accent min-h-11 self-start rounded px-4 font-medium"
          >
            Save language and email
          </button>
        </form>
      </section>

      <!-- ---------------------------------------------------------------- -->
      <section aria-labelledby="device-heading">
        <h2 id="device-heading" class="text-lg font-semibold">This browser</h2>
        <!-- D-06, and SRS part 17's "dark on my laptop, code default on my
             phone". Saying it plainly is cheaper than a support question. -->
        <p class="text-muted mt-1 text-sm">
          These are kept on this device only. They will not follow you to another browser or
          another computer, and they are saved as soon as you change them.
        </p>

        <div class="mt-4 flex flex-col gap-4">
          <div>
            <label for="theme" class="mb-1 block font-medium">Theme</label>
            <select
              id="theme"
              [value]="preferences.theme()"
              (change)="onTheme($event)"
              class="border-line-control bg-surface min-h-11 rounded border px-3"
            >
              <option value="system">Follow my computer</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div>
            <label for="defaultSort" class="mb-1 block font-medium">Default sort on the board</label>
            <select
              id="defaultSort"
              [value]="preferences.defaultSort()"
              (change)="onSort($event)"
              class="border-line-control bg-surface min-h-11 rounded border px-3"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="most_votes">Most votes</option>
              <option value="most_comments">Most comments</option>
            </select>
          </div>

          <fieldset>
            <legend class="mb-1 font-medium">Default category filter</legend>
            <div class="flex flex-wrap gap-3">
              @for (category of bootstrap.activeCategories(); track category.id) {
                <label class="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    [checked]="preferences.defaultCategoryIds().includes(category.id)"
                    (change)="toggleCategory(category.id)"
                  />
                  {{ category.name }}
                </label>
              }
            </div>
          </fieldset>
        </div>
      </section>

      <!-- ---------------------------------------------------------------- -->
      <section aria-labelledby="danger-heading" class="border-danger-line rounded-lg border p-6">
        <h2 id="danger-heading" class="text-danger text-lg font-semibold">Delete my account</h2>

        <!-- R-61: the question says what will happen *before* they press it. -->
        <p class="text-muted mt-2">
          Your name, picture and email address will be wiped and your sign-in will stop working.
          Your votes will be removed. Your requests and comments will stay on the board, shown as
          “Deleted user”. This cannot be undone.
        </p>

        @if (store.deleteError(); as failure) {
          <p role="alert" class="border-danger-line bg-danger-subtle mt-4 rounded border px-4 py-3">
            @if (failure.status === 409) {
              <!-- R-62: the app must never be left with nobody who can run it. -->
              You are the only admin, so this account cannot be deleted. Make somebody else an
              admin first.
            } @else {
              We could not delete your account. Nothing has been changed — try again.
            }
          </p>
        }

        @if (!confirming()) {
          <button
            type="button"
            class="border-danger-line text-danger mt-4 min-h-11 rounded border px-4 font-medium"
            (click)="confirming.set(true)"
          >
            Delete my account
          </button>
        } @else {
          <div class="mt-4">
            <label for="confirm-text" class="mb-1 block font-medium">
              Type DELETE to confirm
            </label>
            <input
              id="confirm-text"
              type="text"
              [value]="confirmText()"
              (input)="confirmText.set(asValue($event))"
              class="border-line-control bg-surface min-h-11 rounded border px-3"
            />
            <div class="mt-3 flex gap-3">
              <button
                type="button"
                class="bg-danger min-h-11 rounded px-4 font-medium text-white disabled:opacity-50"
                [disabled]="confirmText() !== 'DELETE' || store.isSaving()"
                (click)="deleteAccount()"
              >
                Delete my account for good
              </button>
              <button type="button" class="min-h-11 px-4 underline" (click)="cancelDelete()">
                Keep my account
              </button>
            </div>
          </div>
        }
      </section>
    </div>
  `,
})
export class Settings {
  protected readonly store = inject(SettingsStore);
  protected readonly bootstrap = inject(BootstrapStore);
  protected readonly preferences = inject(DevicePreferencesStore);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  // Seeded from the one start-up call, so this screen needs no request of its
  // own to draw itself (R-52).
  protected readonly displayName = signal(this.bootstrap.user()?.displayName ?? '');
  protected readonly avatarUrl = signal(this.bootstrap.user()?.avatarUrl ?? '');
  protected readonly language = signal<'en' | 'ar'>(
    this.bootstrap.mySettings()?.language === 'ar' ? 'ar' : 'en',
  );
  protected readonly notifyOnComment = signal(
    this.bootstrap.mySettings()?.notifyOnComment ?? true,
  );
  protected readonly notifyOnStatusChange = signal(
    this.bootstrap.mySettings()?.notifyOnStatusChange ?? true,
  );

  protected readonly confirming = signal(false);
  protected readonly confirmText = signal('');

  protected asValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected asChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  /**
   * The narrowing happens here rather than in the template: a template has no
   * casts, and a `<select>` value is only ever one of the options we wrote, so
   * this is the one place that has to say so.
   */
  protected onTheme(event: Event): void {
    const value = this.asValue(event);
    if (value === 'light' || value === 'dark' || value === 'system') {
      this.preferences.setTheme(value);
    }
  }

  protected onSort(event: Event): void {
    const value = this.asValue(event);
    if (
      value === 'newest' ||
      value === 'oldest' ||
      value === 'most_votes' ||
      value === 'most_comments'
    ) {
      this.preferences.setDefaultSort(value);
    }
  }

  protected async saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    await this.store.saveProfile({
      displayName: this.displayName(),
      avatarUrl: this.avatarUrl(),
    });
  }

  protected async saveSettings(event: Event): Promise<void> {
    event.preventDefault();
    const saved = await this.store.saveSettings({
      language: this.language(),
      notifyOnComment: this.notifyOnComment(),
      notifyOnStatusChange: this.notifyOnStatusChange(),
    });

    // R-57: the language is kept on the server and copied into the browser, so
    // the pre-paint script can start the next load in the right direction.
    if (saved !== null) {
      this.preferences.setStoredLanguage(saved.language);
    }
  }

  protected toggleCategory(id: string): void {
    const current = this.preferences.defaultCategoryIds();
    this.preferences.setDefaultCategoryIds(
      current.includes(id) ? current.filter((one) => one !== id) : [...current, id],
    );
  }

  protected cancelDelete(): void {
    this.confirming.set(false);
    this.confirmText.set('');
  }

  protected async deleteAccount(): Promise<void> {
    if (await this.store.deleteAccount()) {
      // The account is gone; the session must go with it rather than leaving a
      // signed-in app pointing at a person who no longer exists.
      this.session.signOut();
    } else {
      void this.router.navigate([], { queryParams: {} });
    }
  }
}
