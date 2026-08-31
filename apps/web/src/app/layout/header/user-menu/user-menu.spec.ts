import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { UserMenu } from './user-menu';
import { BootstrapStore } from '../../../core/bootstrap/bootstrap.store';
import { DevicePreferencesStore } from '../../../core/config/device-preferences.store';
import { Session } from '../../../core/auth/session';

const ROUTES = [{ path: '**', children: [] }];

describe('the user menu', () => {
  const bootstrap = {
    user: signal({ id: 'u1', displayName: 'Ada Admin', avatarUrl: null, role: 'admin' as const }),
    isAdmin: signal(true),
  };

  const preferences = {
    theme: signal<'system' | 'light' | 'dark'>('system'),
    setTheme: vi.fn(),
    storedLanguage: () => null,
    setStoredLanguage: vi.fn(),
  };

  const session = { signOut: vi.fn() };

  async function renderMenu() {
    const utils = await render(UserMenu, {
      providers: [
        provideRouter(ROUTES),
        { provide: BootstrapStore, useValue: bootstrap },
        { provide: DevicePreferencesStore, useValue: preferences },
        { provide: Session, useValue: session },
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    return utils;
  }

  it('shows the admin badge, not a generic "my account" label', async () => {
    await renderMenu();

    const badge = screen.getByRole('menu').querySelector('.user-menu-header-badge');
    expect(badge).toHaveTextContent('Admin');
    expect(screen.queryByText(/my account/i)).not.toBeInTheDocument();
  });

  it('changes the theme from a segmented control, without a submenu', async () => {
    await renderMenu();

    await userEvent.click(screen.getByRole('radio', { name: /dark/i }));

    expect(preferences.setTheme).toHaveBeenCalledWith('dark');
  });

  it('lists Settings and Admin as menu items', async () => {
    await renderMenu();

    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /admin/i })).toBeInTheDocument();
  });
});
