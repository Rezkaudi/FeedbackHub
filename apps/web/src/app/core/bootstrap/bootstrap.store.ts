import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../api/schema';
import { toApiError, type ApiError } from '../error/api-error';

/**
 * Everything the app needs before it can draw anything, fetched in one call
 * (R-52, hard part H-4).
 *
 * Shapes come from the generated contract, so if the server changes what
 * `/v1/bootstrap` returns this file stops compiling rather than failing in a
 * browser.
 */
type BootstrapResponse = components['schemas']['BootstrapResponse'];
export type BootstrapUser = BootstrapResponse['user'];
export type MySettings = BootstrapResponse['settings'];
export type Features = BootstrapResponse['features'];
export type Category = BootstrapResponse['categories'][number];
export type Status = BootstrapResponse['statuses'][number];

/**
 * `signedOut` is deliberately not `failed`. Not being signed in is the normal
 * first visit, and treating it as an error would show a Try again button for
 * something no amount of trying will fix (SRS 15.8).
 */
export type BootstrapStatus = 'loading' | 'ready' | 'signedOut' | 'failed';

@Injectable({ providedIn: 'root' })
export class BootstrapStore {
  private readonly http = inject(HttpClient);

  private readonly state = signal<BootstrapStatus>('loading');
  private readonly data = signal<BootstrapResponse | null>(null);
  private readonly failure = signal<ApiError | null>(null);

  public readonly status: Signal<BootstrapStatus> = this.state.asReadonly();
  public readonly error: Signal<ApiError | null> = this.failure.asReadonly();

  public readonly user = computed<BootstrapUser | null>(() => this.data()?.user ?? null);
  public readonly mySettings = computed<MySettings | null>(() => this.data()?.settings ?? null);
  public readonly language = computed<string | null>(() => this.data()?.settings.language ?? null);
  public readonly isAdmin = computed<boolean>(() => this.data()?.user.role === 'admin');

  /** R-42: the screen obeys these, and so does the server. Both, never one. */
  public readonly commentsEnabled = computed<boolean>(
    () => this.data()?.features.commentsEnabled ?? false,
  );
  public readonly commentsRequireApproval = computed<boolean>(
    () => this.data()?.features.commentsRequireApproval ?? false,
  );

  /**
   * Every category, retired ones included. A request keeps pointing at the
   * category it was written under, so labelling an old request needs the whole
   * list (R-45).
   */
  public readonly categories = computed<readonly Category[]>(() => this.data()?.categories ?? []);
  public readonly statuses = computed<readonly Status[]>(() => this.data()?.statuses ?? []);

  /** What a picker may offer. The split happens once, here, not per screen. */
  public readonly activeCategories = computed<readonly Category[]>(() =>
    this.categories().filter((category) => category.isActive),
  );
  public readonly activeStatuses = computed<readonly Status[]>(() =>
    this.statuses().filter((status) => status.isActive),
  );

  public readonly defaultStatus = computed<Status | undefined>(() =>
    this.statuses().find((status) => status.isDefault),
  );

  public categoryById(id: string): Category | undefined {
    return this.categories().find((category) => category.id === id);
  }

  public statusById(id: string): Status | undefined {
    return this.statuses().find((status) => status.id === id);
  }

  /**
   * The one call, and the promise that it never rejects.
   *
   * A rejected app initializer aborts Angular's bootstrap, and what the person
   * gets is a blank page — exactly what SRS 15.8 forbids. So every outcome ends
   * as state the shell can render: ready, signed out, or failed with a Try
   * again button.
   *
   * `withCredentials` because the cookies are the only credential the browser
   * has. There is no token to attach; there is deliberately nothing in
   * JavaScript to attach (R-3c).
   */
  public async load(): Promise<void> {
    this.state.set('loading');
    this.failure.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<BootstrapResponse>('/v1/bootstrap', { withCredentials: true }),
      );

      this.data.set(response);
      this.state.set('ready');
    } catch (cause) {
      const error = toApiError(cause);

      if (error.status === 401) {
        this.state.set('signedOut');
        return;
      }

      this.failure.set(error);
      this.state.set('failed');
    }
  }

  /**
   * Write-back after a successful mutation, so the whole app updates without a
   * reload (SRS 15.6, 15.7).
   *
   * `/v1/bootstrap` is fetched once at start-up (R-52), and every screen reads
   * the viewer, their settings, the feature switches and the taxonomy from the
   * signals here. When a person renames themselves, an admin retires a category
   * or turns comments off, the store that made the call also tells this store
   * what changed — otherwise the header, the pickers and the filters keep
   * showing the old value until the next full page load.
   *
   * Each merge is a no-op before the first load, and takes the caller's values
   * as given: they come straight from the server's answer to the write.
   */
  public applyUser(patch: Partial<BootstrapUser>): void {
    this.data.update((data) =>
      data === null ? data : { ...data, user: { ...data.user, ...patch } },
    );
  }

  public applyMySettings(patch: Partial<MySettings>): void {
    this.data.update((data) =>
      data === null ? data : { ...data, settings: { ...data.settings, ...patch } },
    );
  }

  public applyFeatures(patch: Partial<Features>): void {
    this.data.update((data) =>
      data === null ? data : { ...data, features: { ...data.features, ...patch } },
    );
  }

  /**
   * The whole taxonomy at once: an admin edit can retire one row and un-retire
   * another in the same step (R-47), so guessing the delta locally would risk
   * showing two defaults. The admin screen has just re-read `/v1/taxonomy`;
   * these are those rows, narrowed to what bootstrap carries.
   */
  public applyTaxonomy(
    categories: readonly Category[],
    statuses: readonly Status[],
  ): void {
    this.data.update((data) =>
      data === null
        ? data
        : { ...data, categories: [...categories], statuses: [...statuses] },
    );
  }

  /**
   * Re-read the taxonomy on its own, for a non-admin who just learned it is
   * stale: the request form submitted a category the server has since retired
   * (another tab, another person), so the picker is showing an option that no
   * longer exists. This pulls the current list so the dead row drops out.
   */
  public async refreshTaxonomy(): Promise<void> {
    try {
      const taxonomy = await firstValueFrom(
        this.http.get<TaxonomyResponse>('/v1/taxonomy', { withCredentials: true }),
      );
      this.applyTaxonomy(
        taxonomy.categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          color: category.color,
          isActive: category.isActive,
        })),
        taxonomy.statuses.map((status) => ({
          id: status.id,
          name: status.name,
          slug: status.slug,
          color: status.color,
          isActive: status.isActive,
          isDefault: status.isDefault,
        })),
      );
    } catch {
      // Best effort. If it fails the picker keeps what it had, and the form's
      // own error message still tells the person what went wrong.
    }
  }
}

type TaxonomyResponse = components['schemas']['TaxonomyResponse'];
