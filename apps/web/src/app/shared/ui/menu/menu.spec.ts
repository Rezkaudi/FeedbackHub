import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Menu } from './menu';
import { MenuItem } from './menu-item';

@Component({
  selector: 'fh-test-host',
  imports: [Menu, MenuItem],
  template: `
    <p>Outside</p>
    <fh-menu #menu="fhMenu">
      <button menuTrigger type="button" aria-haspopup="menu" [attr.aria-expanded]="menu.open()" (click)="menu.toggle()">
        Account menu
      </button>
      <div menuPanel>
        <fh-menu-item icon="user" routerLink="/settings">First item</fh-menu-item>
        <fh-menu-item icon="log-out">Second item</fh-menu-item>
      </div>
    </fh-menu>
  `,
})
class TestHost {}

const ROUTES = [
  { path: '', component: TestHost },
  { path: 'elsewhere', component: TestHost },
];

describe('the menu', () => {
  it('shows the label text on every item, including ones that navigate', async () => {
    await render(TestHost, { providers: [provideRouter(ROUTES)] });

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));

    expect(screen.getByRole('menuitem', { name: 'First item' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Second item' })).toBeInTheDocument();
  });

  it('opens on trigger click and closes on Escape, returning focus to the trigger', async () => {
    await render(TestHost, { providers: [provideRouter(ROUTES)] });

    const trigger = screen.getByRole('button', { name: 'Account menu' });
    await userEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when a click lands outside it', async () => {
    await render(TestHost, { providers: [provideRouter(ROUTES)] });

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Outside'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves focus between items with the arrow keys', async () => {
    await render(TestHost, { providers: [provideRouter(ROUTES)] });

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const items = screen.getAllByRole('menuitem');
    items[0].focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(items[0]).toHaveFocus();
  });

  it('closes when the route changes', async () => {
    const { fixture } = await render(TestHost, { providers: [provideRouter(ROUTES)] });

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    const router = TestBed.inject(Router);
    await fixture.ngZone!.run(() => router.navigateByUrl('/elsewhere'));
    fixture.detectChanges();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
