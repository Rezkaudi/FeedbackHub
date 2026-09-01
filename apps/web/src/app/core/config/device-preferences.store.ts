import { Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import type { operations } from '../api/schema';

/**
 * The settings that belong to this browser and not to the person: theme, the
 * default sort, and the default filters (R-58, D-06).
 *
 * They are kept here rather than on the server on purpose. A theme follows a
 * screen, not a person — signing in on a shared machine or in a private window
 * should not drag your laptop's dark mode along with you. Language and email
 * choices are the opposite, and live on the server, because the worker needs to
 * know your language to write you an email while you are signed out.
 *
 * Resolution is R-51's two layers and nothing more: the code default, then what
 * this browser has stored. The last one filled in wins. There is no third layer
 * here, so there is no ordering to get wrong.
 */

/**
 * Taken from the generated contract rather than retyped, so if the server ever
 * adds or drops a sort this stops compiling instead of silently sending a name
 * the server will refuse (R-20).
 */
export type Sort = NonNullable<
  NonNullable<operations['RequestsController_board']['parameters']['query']>['sort']
>;

export type Theme = 'light' | 'dark' | 'system';

const SORTS: readonly Sort[] = ['newest', 'oldest', 'most_votes', 'most_comments'];
const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

/** The shipped defaults — R-51's first layer. */
const DEFAULT_THEME: Theme = 'system';
const DEFAULT_SORT: Sort = 'newest';

/**
 * The key names are also read by the inline script in index.html, which runs
 * before Angular exists in order to set the theme before the first paint
 * (R-56). If a name changes here it must change there too, or the flash comes
 * back — so they are constants with that warning attached rather than strings
 * scattered through the file.
 */
const KEY = {
  theme: 'fh.theme',
  language: 'fh.language',
  sort: 'fh.defaultSort',
  statusIds: 'fh.defaultStatusIds',
  categoryIds: 'fh.defaultCategoryIds',
  mine: 'fh.defaultMine',
} as const;

/**
 * Every read and write is wrapped, because `localStorage` does not merely
 * return null when it is unavailable — a private window, or a browser set to
 * block site data, throws on access. This store is read by the shell before it
 * renders anything, so an unhandled throw here is a blank page rather than a
 * missing preference.
 */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* The choice still applies to this session; it just will not survive a
     * reload. That is strictly better than refusing the change. */
  }
}

function oneOf<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/**
 * A stored filter is JSON we wrote, but it may have been written by an older
 * version of the app or edited by hand in a console. Anything that is not a
 * list of strings is treated as "not set" rather than trusted.
 */
function readIds(key: string): string[] {
  const raw = read(key);
  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class DevicePreferencesStore {
  private readonly themeChoice: WritableSignal<Theme> = signal(
    oneOf(THEMES, read(KEY.theme), DEFAULT_THEME),
  );
  private readonly sort: WritableSignal<Sort> = signal(oneOf(SORTS, read(KEY.sort), DEFAULT_SORT));
  private readonly statusIds: WritableSignal<string[]> = signal(readIds(KEY.statusIds));
  private readonly categoryIds: WritableSignal<string[]> = signal(readIds(KEY.categoryIds));
  private readonly mine: WritableSignal<boolean> = signal(read(KEY.mine) === 'true');

  public readonly theme: Signal<Theme> = this.themeChoice.asReadonly();
  public readonly defaultSort: Signal<Sort> = this.sort.asReadonly();
  public readonly defaultStatusIds: Signal<readonly string[]> = this.statusIds.asReadonly();
  public readonly defaultCategoryIds: Signal<readonly string[]> = this.categoryIds.asReadonly();
  public readonly defaultMine: Signal<boolean> = this.mine.asReadonly();

  public setTheme(theme: Theme): void {
    this.themeChoice.set(theme);
    write(KEY.theme, theme);
  }

  public setDefaultSort(sort: Sort): void {
    this.sort.set(sort);
    write(KEY.sort, sort);
  }

  public setDefaultStatusIds(ids: readonly string[]): void {
    this.statusIds.set([...ids]);
    write(KEY.statusIds, JSON.stringify(ids));
  }

  public setDefaultCategoryIds(ids: readonly string[]): void {
    this.categoryIds.set([...ids]);
    write(KEY.categoryIds, JSON.stringify(ids));
  }

  public setDefaultMine(mine: boolean): void {
    this.mine.set(mine);
    write(KEY.mine, mine ? 'true' : 'false');
  }

  /**
   * SRS 15.6: a saved default filter that points at a category retired since it
   * was saved is skipped, and nothing breaks.
   *
   * The caller passes the ids that still exist — it has them already, from the
   * one start-up call — and gets back the intersection. A filter that has
   * entirely gone becomes no filter, which shows the whole board rather than an
   * empty one, and an empty board with no explanation is the worse failure.
   */
  public knownCategoryIds(existing: readonly string[]): string[] {
    return this.categoryIds().filter((id) => existing.includes(id));
  }

  public knownStatusIds(existing: readonly string[]): string[] {
    return this.statusIds().filter((id) => existing.includes(id));
  }

  /** The language the pre-paint script found, so the app can start in it. */
  public storedLanguage(): string | null {
    return read(KEY.language);
  }

  public setStoredLanguage(language: string): void {
    write(KEY.language, language);
  }
}
