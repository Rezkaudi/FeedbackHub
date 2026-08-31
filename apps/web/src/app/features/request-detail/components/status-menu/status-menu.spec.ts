import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Status } from '../../../../core/bootstrap/bootstrap.store';
import { StatusMenu } from './status-menu';

const STATUSES = [
  { id: 's1', name: 'New', color: '#888', isActive: true, isDefault: true },
  { id: 's2', name: 'In Progress', color: '#08f', isActive: true, isDefault: false },
  { id: 's3', name: 'Done', color: '#0a0', isActive: true, isDefault: false },
] as unknown as readonly Status[];

const renderMenu = (currentId: string) =>
  render(StatusMenu, { inputs: { statuses: STATUSES, currentId } });

describe('the status menu', () => {
  it('shows the current status on the trigger', async () => {
    await renderMenu('s2');

    expect(screen.getByRole('button', { name: /change status/i })).toHaveTextContent('In Progress');
  });

  it('emits the picked status, and nothing when the current one is chosen again', async () => {
    const changed = vi.fn();
    const { fixture } = await renderMenu('s1');
    fixture.componentInstance.changed.subscribe(changed);

    await userEvent.click(screen.getByRole('button', { name: /change status/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Done' }));
    expect(changed).toHaveBeenCalledWith('s3');

    await userEvent.click(screen.getByRole('button', { name: /change status/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
