import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../../core/api/schema';
import { toApiError, type ApiError } from '../../core/error/api-error';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';

type MyProfile = components['schemas']['MyProfileResponse'];
type MySettings = components['schemas']['MySettingsResponse'];

export interface ProfileDraft {
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

/**
 * Exactly the settings R-60 allows a person to change through the API, and
 * nothing else. Theme, default sort and default filters are deliberately absent
 * — they live in the browser (D-06) and sending one would be refused.
 */
export interface SettingsDraft {
  readonly language: 'en' | 'ar';
  readonly notifyOnComment: boolean;
  readonly notifyOnStatusChange: boolean;
}

/**
 * SRS 15.6: "each part saves on its own and says 'Saved'." So the outcomes are
 * kept apart: a failure saving the language must not make a name that saved a
 * moment ago look unsaved.
 */
@Injectable()
export class SettingsStore {
  private readonly http = inject(HttpClient);
  private readonly bootstrap = inject(BootstrapStore);

  private readonly profileOk = signal(false);
  private readonly settingsOk = signal(false);
  private readonly profileFailure = signal<ApiError | null>(null);
  private readonly settingsFailure = signal<ApiError | null>(null);
  private readonly deleteFailure = signal<ApiError | null>(null);
  private readonly busy = signal(false);

  public readonly profileSaved: Signal<boolean> = this.profileOk.asReadonly();
  public readonly settingsSaved: Signal<boolean> = this.settingsOk.asReadonly();
  public readonly profileError: Signal<ApiError | null> = this.profileFailure.asReadonly();
  public readonly settingsError: Signal<ApiError | null> = this.settingsFailure.asReadonly();
  public readonly deleteError: Signal<ApiError | null> = this.deleteFailure.asReadonly();
  public readonly isSaving: Signal<boolean> = this.busy.asReadonly();

  public async saveProfile(draft: ProfileDraft): Promise<MyProfile | null> {
    this.profileOk.set(false);
    this.profileFailure.set(null);

    try {
      const saved = await firstValueFrom(
        this.http.patch<MyProfile>('/v1/me', {
          displayName: draft.displayName.trim(),
          // R-54: with no picture we draw their initials. An empty string is an
          // address that is nothing; null is "I have no picture". The server
          // needs the second, so an emptied box becomes null.
          avatarUrl: draft.avatarUrl === null || draft.avatarUrl.trim() === ''
            ? null
            : draft.avatarUrl.trim(),
        }),
      );

      // R-53, R-54: the header, the menu and this page all read the viewer from
      // the bootstrap store. Push the saved values there so the new name and
      // picture show at once, with no page reload.
      this.bootstrap.applyUser({
        displayName: saved.displayName,
        avatarUrl: saved.avatarUrl,
      });

      this.profileOk.set(true);
      return saved;
    } catch (cause) {
      this.profileFailure.set(toApiError(cause));
      return null;
    }
  }

  public async saveSettings(draft: SettingsDraft): Promise<MySettings | null> {
    this.settingsOk.set(false);
    this.settingsFailure.set(null);

    try {
      // Spelled out field by field rather than spread, so a future field cannot
      // be carried to the server by accident and refused under R-60.
      const saved = await firstValueFrom(
        this.http.patch<MySettings>('/v1/settings/me', {
          language: draft.language,
          notifyOnComment: draft.notifyOnComment,
          notifyOnStatusChange: draft.notifyOnStatusChange,
        }),
      );

      // R-59: keep the app-wide copy of my settings in step, so the toggles
      // stay put and the resolved language is right everywhere at once.
      this.bootstrap.applyMySettings({
        language: saved.language,
        notifyOnComment: saved.notifyOnComment,
        notifyOnStatusChange: saved.notifyOnStatusChange,
      });

      this.settingsOk.set(true);
      return saved;
    } catch (cause) {
      this.settingsFailure.set(toApiError(cause));
      return null;
    }
  }

  /**
   * R-61: their name, picture and email are wiped, their sign-in stops working
   * and their votes go; their requests and comments stay as "Deleted user".
   * R-62: refused for the last admin, with the reason.
   */
  public async deleteAccount(): Promise<boolean> {
    if (this.busy()) {
      return false;
    }

    this.busy.set(true);
    this.deleteFailure.set(null);

    try {
      await firstValueFrom(this.http.delete<void>('/v1/me'));
      return true;
    } catch (cause) {
      this.deleteFailure.set(toApiError(cause));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
