import { CODE_DEFAULTS, Language } from './code-defaults';

export interface UserSettingsState {
  userId: string;
  /** Empty means "I did not change this" — use the code default (R-51). */
  language: Language | null;
  notifyOnComment: boolean;
  notifyOnStatusChange: boolean;
}

/**
 * The settings a person owns. Exactly two kinds, and no more (R-60):
 *
 *   language          — kept on the server, because the email is written at the
 *                       moment the event happens, possibly while the person is
 *                       signed out, and the server must know their language then.
 *   the two email choices.
 *
 * Theme, default sort and default filters are *not* here on purpose. They live
 * in the browser, per device (D-06). A request that tries to set them through
 * this API is refused with a message, never quietly ignored — the DTO has no
 * such field, and the global pipe rejects unknown fields outright.
 */
export class UserSettings {
  private constructor(private readonly state: UserSettingsState) {}

  public static defaultsFor(userId: string): UserSettings {
    return new UserSettings({
      userId,
      language: null,
      notifyOnComment: CODE_DEFAULTS.notifyOnComment,
      notifyOnStatusChange: CODE_DEFAULTS.notifyOnStatusChange,
    });
  }

  public static rehydrate(state: UserSettingsState): UserSettings {
    return new UserSettings({ ...state });
  }

  public get userId(): string {
    return this.state.userId;
  }

  /** The raw stored value: null means "not changed". */
  public get storedLanguage(): Language | null {
    return this.state.language;
  }

  /**
   * Layer two of R-51, resolved: code default, then the user. The last one
   * filled in wins, and this is the one place that decides it.
   */
  public get language(): Language {
    return this.state.language ?? CODE_DEFAULTS.language;
  }

  public get notifyOnComment(): boolean {
    return this.state.notifyOnComment;
  }
  public get notifyOnStatusChange(): boolean {
    return this.state.notifyOnStatusChange;
  }

  public change(changes: {
    language?: Language | null;
    notifyOnComment?: boolean;
    notifyOnStatusChange?: boolean;
  }): void {
    if (changes.language !== undefined) {
      this.state.language = changes.language;
    }
    if (changes.notifyOnComment !== undefined) {
      this.state.notifyOnComment = changes.notifyOnComment;
    }
    if (changes.notifyOnStatusChange !== undefined) {
      this.state.notifyOnStatusChange = changes.notifyOnStatusChange;
    }
  }

  public snapshot(): Readonly<UserSettingsState> {
    return { ...this.state };
  }
}
