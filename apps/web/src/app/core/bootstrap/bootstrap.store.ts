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
}
