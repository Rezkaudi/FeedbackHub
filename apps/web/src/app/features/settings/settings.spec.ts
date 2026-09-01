import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Settings } from './settings';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { DevicePreferencesStore } from '../../core/config/device-preferences.store';
import { Session } from '../../core/auth/session';
import { ConfirmDialog } from '../../shared/ui/dialog/confirm-dialog';

const ANY_ROUTE = [{ path: '**', children: [] }];

describe('the settings screen', () => {
  const bootstrap = {
    user: signal({ id: 'u1', displayName: 'Sam', avatarUrl: null, role: 'user' }),
    mySettings: signal({ language: 'en', notifyOnComment: true, notifyOnStatusChange: false }),
    activeCategories: signal([{ id: 'c1', name: 'Bug', color: '#DC2626', isActive: true }]),
    activeStatuses: signal([{ id: 's1', name: 'New', color: '#0369A1', isActive: true }]),
    categories: signal([
      { id: 'c1', name: 'Bug', color: '#DC2626', isActive: true },
      { id: 'c2', name: 'Legacy', color: '#78716C', isActive: false },
    ]),
    statuses: signal([
      { id: 's1', name: 'New', color: '#0369A1', isActive: true },
      { id: 's2', name: 'Under Review', color: '#78716C', isActive: false },
    ]),
    applyUser: vi.fn(),
    applyMySettings: vi.fn(),
  };

  const preferences = {
    theme: signal('system'),
    defaultSort: signal('newest'),
    defaultCategoryIds: signal<string[]>([]),
    defaultStatusIds: signal<string[]>([]),
    defaultMine: signal(false),
    setTheme: vi.fn(),
    setDefaultSort: vi.fn(),
    setDefaultCategoryIds: vi.fn(),
    setDefaultStatusIds: vi.fn(),
    setDefaultMine: vi.fn(),
    setStoredLanguage: vi.fn(),
    storedLanguage: () => null,
  };

  const session = { signOut: vi.fn(), signIn: vi.fn(), markSignedOut: vi.fn() };

  async function renderSettings() {
    const utils = await render('<fh-settings></fh-settings><fh-confirm-dialog></fh-confirm-dialog>', {
      imports: [Settings, ConfirmDialog],
      providers: [
        provideRouter(ANY_ROUTE),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BootstrapStore, useValue: bootstrap },
        { provide: DevicePreferencesStore, useValue: preferences },
        { provide: Session, useValue: session },
      ],
    });
    return { backend: TestBed.inject(HttpTestingController), ...utils };
  }

  it('starts filled in from the one start-up call, with no request of its own', async () => {
    await renderSettings();

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Sam');
  });

  it('saves the profile on its own and says Saved', async () => {
    const { backend, fixture } = await renderSettings();

    await userEvent.clear(screen.getByLabelText(/display name/i));
    await userEvent.type(screen.getByLabelText(/display name/i), 'Sam Smith');
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));

    const request = backend.expectOne('/v1/me');
    expect(request.request.body).toEqual({ displayName: 'Sam Smith', avatarUrl: null });
    request.flush({ id: 'u1', displayName: 'Sam Smith', avatarUrl: null, role: 'user' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(screen.getByRole('status')).toHaveTextContent(/saved/i);
  });

  it('will not save an empty display name', async () => {
    await renderSettings();

    await userEvent.clear(screen.getByLabelText(/display name/i));

    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
    expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
  });

  it('changes the theme without asking the server', async () => {
    await renderSettings();

    await userEvent.click(screen.getByRole('radio', { name: /dark/i }));

    expect(preferences.setTheme).toHaveBeenCalledWith('dark');
  });

  describe('deleting my account', () => {
    it('says what will happen before offering the button', async () => {
      await renderSettings();

      const section = screen.getByRole('region', { name: /delete/i });
      expect(section).toHaveTextContent(/sign-in stops working/i);
      expect(section).toHaveTextContent(/votes go/i);
      expect(section).toHaveTextContent(/deleted user/i);
    });

    it('asks first, and deletes only after confirming', async () => {
      const { backend, fixture } = await renderSettings();

      await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent(/cannot be undone/i);

      await userEvent.click(within(dialog).getByRole('button', { name: /delete my account/i }));
      await fixture.whenStable();

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

      const request = backend.expectOne('/v1/me');
      expect(request.request.method).toBe('DELETE');
      request.flush(null);
    });

    it('does not delete when they change their mind', async () => {
      const { backend } = await renderSettings();

      await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
      const dialog = screen.getByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      backend.expectNone('/v1/me');
    });

    it('explains that the last admin cannot leave', async () => {
      const { backend, fixture } = await renderSettings();

      await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
      const dialog = screen.getByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /delete my account/i }));

      backend.expectOne('/v1/me').flush(
        { error: { code: 'CONFLICT', message: 'last admin', requestId: 'r' } },
        { status: 409, statusText: 'Conflict' },
      );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(screen.getByRole('alert')).toHaveTextContent(/only admin/i);
    });
  });
});
