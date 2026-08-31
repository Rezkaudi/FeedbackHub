import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Component, signal } from '@angular/core';
import { Dialog } from './dialog';

@Component({
  selector: 'fh-test-host',
  imports: [Dialog],
  template: `
    <button type="button" (click)="isOpen.set(true)">Open</button>
    <fh-dialog [open]="isOpen()" heading="Delete request" (closed)="isOpen.set(false)">
      <p>Are you sure?</p>
    </fh-dialog>
  `,
})
class TestHost {
  public isOpen = signal(false);
}

describe('the dialog', () => {
  it('opens as a modal and returns focus to the trigger on close', async () => {
    await render(TestHost);

    const trigger = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(trigger);

    expect(screen.getByRole('heading', { name: 'Delete request' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Are you sure?')).not.toBeVisible();
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape', async () => {
    await render(TestHost);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText('Are you sure?')).not.toBeVisible();
  });

  it('closes on a backdrop click', async () => {
    await render(TestHost);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    await userEvent.click(document.querySelector('dialog')!);

    expect(screen.queryByText('Are you sure?')).not.toBeVisible();
  });
});
