import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '../../core/api/schema';
import { toApiError, type ApiError } from '../../core/error/api-error';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';

type Taxonomy = components['schemas']['TaxonomyResponse'];
export type AdminCategory = Taxonomy['categories'][number];
export type AdminStatus = Taxonomy['statuses'][number];
export type AppSettings = components['schemas']['AppSettingsResponse'];
export type Invitation = components['schemas']['InvitationResponse'];
export type PendingComment = components['schemas']['CommentResponse'];

export type AdminState = 'loading' | 'ready' | 'failed';

/**
 * Everything an admin changes, behind one store per screen's worth of work.
 *
 * Every method here is a courtesy on top of a server check, never instead of
 * one (R-70, R-93). A normal person who types an admin address gets a 403 from
 * the API whatever this file does, and the E2E suite proves that by calling the
 * endpoints directly with a non-admin session.
 *
 * The refusals matter as much as the actions. SRS 15.7 lists three that are
 * blocked on purpose — retiring the first status, retiring the last category,
 * deleting a taxonomy row still in use — and each must arrive as a reason a
 * person can act on, not as a generic failure.
 */
@Injectable()
export class AdminStore {
  private readonly http = inject(HttpClient);
  private readonly bootstrap = inject(BootstrapStore);

  private readonly current = signal<AdminState>('loading');
  private readonly categoryRows = signal<readonly AdminCategory[]>([]);
  private readonly statusRows = signal<readonly AdminStatus[]>([]);
  private readonly settingsRow = signal<AppSettings | null>(null);
  private readonly invitationRows = signal<readonly Invitation[]>([]);
  private readonly pendingRows = signal<readonly PendingComment[]>([]);
  private readonly failure = signal<ApiError | null>(null);
  private readonly actionFailure = signal<ApiError | null>(null);
  private readonly saved = signal(false);

  public readonly state: Signal<AdminState> = this.current.asReadonly();
  public readonly categories: Signal<readonly AdminCategory[]> = this.categoryRows.asReadonly();
  public readonly statuses: Signal<readonly AdminStatus[]> = this.statusRows.asReadonly();
  public readonly settings: Signal<AppSettings | null> = this.settingsRow.asReadonly();
  public readonly invitations: Signal<readonly Invitation[]> = this.invitationRows.asReadonly();
  public readonly pending: Signal<readonly PendingComment[]> = this.pendingRows.asReadonly();
  public readonly error: Signal<ApiError | null> = this.failure.asReadonly();
  public readonly actionError: Signal<ApiError | null> = this.actionFailure.asReadonly();
  public readonly wasSaved: Signal<boolean> = this.saved.asReadonly();

  // -- reading ---------------------------------------------------------------

  public async loadTaxonomy(keepShowing = false): Promise<void> {
    await this.read(async () => {
      const taxonomy = await firstValueFrom(this.http.get<Taxonomy>('/v1/taxonomy'));
      this.categoryRows.set(taxonomy.categories);
      this.statusRows.set(taxonomy.statuses);

      // R-45 to R-49: the board filters, the request form's category picker and
      // the status menu all read the taxonomy from the bootstrap store. Every
      // admin edit re-reads `/v1/taxonomy` through here, so this is the one
      // place to keep those pickers in step — no page reload.
      this.bootstrap.applyTaxonomy(
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
    }, keepShowing);
  }

  public async loadSettings(keepShowing = false): Promise<void> {
    await this.read(async () => {
      const settings = await firstValueFrom(this.http.get<AppSettings>('/v1/settings/app'));
      this.settingsRow.set(settings);

      // R-42, R-40: the comment section shows or hides and the "pending
      // comments" admin tab appears based on these two, read from the bootstrap
      // store. Keep them in step so turning comments off takes effect at once.
      this.bootstrap.applyFeatures({
        commentsEnabled: settings.featureCommentsEnabled,
        commentsRequireApproval: settings.commentsRequireApproval,
      });
    }, keepShowing);
  }

  public async loadInvitations(keepShowing = false): Promise<void> {
    await this.read(async () => {
      this.invitationRows.set(await firstValueFrom(this.http.get<Invitation[]>('/v1/invitations')));
    }, keepShowing);
  }

  public async loadPending(keepShowing = false): Promise<void> {
    await this.read(async () => {
      this.pendingRows.set(
        await firstValueFrom(this.http.get<PendingComment[]>('/v1/admin/comments/pending')),
      );
    }, keepShowing);
  }

  // -- categories and statuses (R-43 to R-49) --------------------------------

  public addCategory(name: string, color: string): Promise<boolean> {
    return this.act(
      () => this.http.post('/v1/taxonomy/categories', { name, color }),
      () => this.loadTaxonomy(true),
    );
  }

  public changeCategory(id: string, patch: Record<string, unknown>): Promise<boolean> {
    return this.act(
      () => this.http.patch(`/v1/taxonomy/categories/${id}`, patch),
      () => this.loadTaxonomy(true),
    );
  }

  /** R-45: gone from the picker, still correct on the requests that use it. */
  public retireCategory(id: string): Promise<boolean> {
    return this.act(
      () => this.http.post(`/v1/taxonomy/categories/${id}/retire`, null),
      () => this.loadTaxonomy(true),
    );
  }

  /** R-46: the database refuses one that is in use. Retiring is the way out. */
  public deleteCategory(id: string): Promise<boolean> {
    return this.act(
      () => this.http.delete(`/v1/taxonomy/categories/${id}`),
      () => this.loadTaxonomy(true),
    );
  }

  public addStatus(name: string, color: string): Promise<boolean> {
    return this.act(
      () => this.http.post('/v1/taxonomy/statuses', { name, color }),
      () => this.loadTaxonomy(true),
    );
  }

  public changeStatus(id: string, patch: Record<string, unknown>): Promise<boolean> {
    return this.act(
      () => this.http.patch(`/v1/taxonomy/statuses/${id}`, patch),
      () => this.loadTaxonomy(true),
    );
  }

  /** R-48: the first status can never be retired. */
  public retireStatus(id: string): Promise<boolean> {
    return this.act(
      () => this.http.post(`/v1/taxonomy/statuses/${id}/retire`, null),
      () => this.loadTaxonomy(true),
    );
  }

  public deleteStatus(id: string): Promise<boolean> {
    return this.act(
      () => this.http.delete(`/v1/taxonomy/statuses/${id}`),
      () => this.loadTaxonomy(true),
    );
  }

  /** R-47: marking a new first status un-marks the old one, in the same step. */
  public makeDefaultStatus(id: string): Promise<boolean> {
    return this.act(
      () => this.http.post(`/v1/taxonomy/statuses/${id}/make-default`, null),
      () => this.loadTaxonomy(true),
    );
  }

  // -- application settings (R-67 to R-70) -----------------------------------

  /**
   * R-69, R-70: every setting takes effect with no restart, and a half-saved
   * settings row is not a thing that may exist — so this sends the whole shape
   * and takes the server's answer as the new truth.
   */
  public async saveSettings(patch: Partial<AppSettings>): Promise<boolean> {
    return this.act(
      () => this.http.patch<AppSettings>('/v1/settings/app', patch),
      () => this.loadSettings(true),
    );
  }

  // -- moderation (R-41) and invites (R-66) ----------------------------------

  public approveComment(id: string): Promise<boolean> {
    return this.act(
      () => this.http.post(`/v1/admin/comments/${id}/approve`, null),
      () => this.loadPending(true),
    );
  }

  /** R-41: rejecting deletes it for good, and it is never emailed (R-125). */
  public rejectComment(id: string): Promise<boolean> {
    return this.act(
      () => this.http.post(`/v1/admin/comments/${id}/reject`, null),
      () => this.loadPending(true),
    );
  }

  public invite(email: string): Promise<boolean> {
    return this.act(
      () => this.http.post('/v1/invitations', { email }),
      () => this.loadInvitations(true),
    );
  }

  public withdrawInvitation(id: string): Promise<boolean> {
    return this.act(
      () => this.http.delete(`/v1/invitations/${id}`),
      () => this.loadInvitations(true),
    );
  }

  // -- the two shapes every method above is built from -----------------------

  /**
   * `keepShowing` is for the re-read after an action: the screen already has
   * data, so swapping it for the loading skeleton and back would just flash.
   * We leave the current rows and state in place, and on a read error we keep
   * showing the (still correct) old data rather than blanking to an error page
   * — the action itself already succeeded.
   */
  private async read(load: () => Promise<void>, keepShowing = false): Promise<void> {
    const quiet = keepShowing && this.current() === 'ready';

    if (!quiet) {
      this.current.set('loading');
    }
    this.failure.set(null);

    try {
      await load();
      this.current.set('ready');
    } catch (cause) {
      if (quiet) {
        return;
      }
      this.failure.set(toApiError(cause));
      this.current.set('failed');
    }
  }

  /**
   * SRS 15.7: "A setting failed to save -> the old value stays on screen with a
   * message. No half-saved settings." So a failure never touches the rows we
   * are showing, and a success re-reads rather than guessing what changed —
   * making a status the default un-marks another one (R-47), and guessing that
   * locally would be inventing a second copy of a rule the server owns.
   */
  private async act(
    call: () => ReturnType<HttpClient['post']>,
    reload: () => Promise<void>,
  ): Promise<boolean> {
    this.actionFailure.set(null);
    this.saved.set(false);

    try {
      await firstValueFrom(call());
      await reload();
      this.saved.set(true);
      return true;
    } catch (cause) {
      this.actionFailure.set(toApiError(cause));
      return false;
    }
  }
}
