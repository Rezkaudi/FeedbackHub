import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { Breadcrumbs } from './breadcrumbs';

const ROUTES = [{ path: '**', children: [] }];

describe('the breadcrumbs', () => {
  async function renderTrail() {
    return render(Breadcrumbs, {
      providers: [provideRouter(ROUTES)],
      inputs: {
        navLabel: 'Breadcrumb',
        items: [
          { label: 'Board', link: '/' },
          { label: 'Export the board', link: undefined },
        ],
      },
    });
  }

  it('links every step except the current page', async () => {
    await renderTrail();

    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Export the board' })).not.toBeInTheDocument();
  });

  it('marks the last step as the current page', async () => {
    await renderTrail();

    expect(screen.getByText('Export the board')).toHaveAttribute('aria-current', 'page');
  });

  it('names the nav for assistive tech', async () => {
    await renderTrail();

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });
});
