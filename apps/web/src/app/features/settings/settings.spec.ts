import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Settings } from './settings';
import { SettingsStore } from './settings.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { DevicePreferencesStore } from '../../core/config/device-preferences.store';
import { Session } from '../../core/auth/session';

/**
 * SRS 15.6, and the part of R-61 that is a sentence rather than a call: the
 * question asked before deleting an account must say what will happen, in
 * words, before the person can press anything.
 */
// A catch-all so navigations in the component under test resolve. With no
// routes at all, router.navigate() rejects, and an unhandled rejection in one
// spec file leaks into the whole run — it poisoned the admin and board suites
// before this was added.
const ANY_ROUTE = [{ path: '**', children: [] }];

describe('the settings screen', () => {
  function storeIn(over: Record<string, unknown> = {}) {
    return {
      profileSaved: signal(false),
      settingsSaved: signal(false),
      profileError: signal(null),
      settingsError: signal(null),
      deleteError: signal(null),
      isSaving: signal(false),
      saveProfile: vi.fn().mockResolvedValue({ displayName: 'Sam' }),
      saveSettings: vi.fn().mockResolvedValue({ language: 'en' }),
      deleteAccount: vi.fn().mockResolvedValue(true),
      ...over,
    };
  }

  const bootstrap = {
    user: signal({ id: 'u1', displayName: 'Sam', avatarUrl: null, role: 'user' }),
    mySettings: signal({ language: 'en', notifyOnComment: true, notifyOnStatusChange: false }),
    activeCategories: signal([{ id: 'c1', name: 'Bug', color: '#DC2626', isActive: true }]),
  };

  const preferences = {
    theme: signal('system'),
    defaultSort: signal('newest'),
    defaultCategoryIds: signal<string[]>([]),
    setTheme: vi.fn(),
    setDefaultSort: vi.fn(),
    setDefaultCategoryIds: vi.fn(),
    setStoredLanguage: vi.fn(),
  };

  const session = { signOut: vi.fn(), signIn: vi.fn(), markSignedOut: vi.fn() };

  async function renderSettings(store: ReturnType<typeof storeIn>) {
    await render(Settings, {
      providers: [
        provideRouter(ANY_ROUTE),
        { provide: BootstrapStore, useValue: bootstrap },
        { provide: DevicePreferencesStore, useValue: preferences },
        { provide: Session, useValue: session },
      ],
      componentProviders: [{ provide: SettingsStore, useValue: store }],
    });
    return store;
  }

  it('starts filled in from the one start-up call, with no request of its own', async () => {
    await renderSettings(storeIn());

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Sam');
  });

  it('saves the profile on its own', async () => {
    const store = await renderSettings(storeIn());

    await userEvent.clear(screen.getByLabelText(/display name/i));
    await userEvent.type(screen.getByLabelText(/display name/i), 'Sam Smith');
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));

    expect(store.saveProfile).toHaveBeenCalledWith({
      displayName: 'Sam Smith',
      avatarUrl: '',
    });
  });

  it('will not save an empty display name', async () => {
    await renderSettings(storeIn());

    await userEvent.clear(screen.getByLabelText(/display name/i));

    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
    expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
  });

  it('says Saved for the part that saved', async () => {
    await renderSettings(storeIn({ profileSaved: signal(true) }));

    expect(screen.getByRole('status')).toHaveTextContent(/saved/i);
  });

  /** D-06: the browser-only settings say so, so nobody is surprised later. */
  it('says plainly which settings stay on this device', async () => {
    await renderSettings(storeIn());

    expect(screen.getByText(/kept on this device only/i)).toBeInTheDocument();
  });

  it('changes the theme without asking the server', async () => {
    const store = await renderSettings(storeIn());

    await userEvent.selectOptions(screen.getByLabelText(/theme/i), 'dark');

    expect(preferences.setTheme).toHaveBeenCalledWith('dark');
    expect(store.saveSettings).not.toHaveBeenCalled();
  });

  describe('deleting my account', () => {
    /** R-61: the question says what will be lost, before anything is pressed. */
    it('says what will happen before offering the button', async () => {
      await renderSettings(storeIn());

      const section = screen.getByRole('region', { name: /delete my account/i });
      expect(section).toHaveTextContent(/sign-in will stop working/i);
      expect(section).toHaveTextContent(/votes will be removed/i);
      expect(section).toHaveTextContent(/shown as .deleted user./i);
      expect(section).toHaveTextContent(/cannot be undone/i);
    });

    it('needs the word typed out before it will do anything', async () => {
      const store = await renderSettings(storeIn());

      await userEvent.click(screen.getByRole('button', { name: /^delete my account$/i }));
      const confirm = screen.getByRole('button', { name: /for good/i });

      expect(confirm).toBeDisabled();

      await userEvent.type(screen.getByLabelText(/type delete/i), 'DELETE');
      expect(confirm).toBeEnabled();

      await userEvent.click(confirm);
      expect(store.deleteAccount).toHaveBeenCalled();
    });

    /** R-62: the app must never be left with nobody who can run it. */
    it('explains that the last admin cannot leave', async () => {
      await renderSettings(storeIn({ deleteError: signal({ status: 409, code: 'CONFLICT' }) }));

      expect(screen.getByRole('alert')).toHaveTextContent(/only admin/i);
    });
  });
});
