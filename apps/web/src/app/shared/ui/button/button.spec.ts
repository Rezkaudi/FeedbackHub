import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Component } from '@angular/core';
import { Button } from './button';

@Component({
  selector: 'fh-test-host',
  imports: [Button],
  template: `<fh-button [loading]="loading" [disabled]="disabled" (click)="clicked = clicked + 1">Save</fh-button>`,
})
class TestHost {
  public loading = false;
  public disabled = false;
  public clicked = 0;
}

describe('the button', () => {
  it('renders its label', async () => {
    await render(TestHost);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('fires a click when pressed', async () => {
    const { fixture } = await render(TestHost);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(fixture.componentInstance.clicked).toBe(1);
  });

  it('shows a spinner and marks itself busy while loading, and blocks the click', async () => {
    const { fixture } = await render(TestHost, { componentProperties: { loading: true } });

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(fixture.componentInstance.clicked).toBe(0);
  });

  it('is disabled and blocks the click when told to', async () => {
    const { fixture } = await render(TestHost, { componentProperties: { disabled: true } });

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(fixture.componentInstance.clicked).toBe(0);
  });
});
