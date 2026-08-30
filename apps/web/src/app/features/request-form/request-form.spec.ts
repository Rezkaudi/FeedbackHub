import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RequestForm } from './request-form';
import { RequestFormStore } from './request-form.store';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';

/**
 * The form, through what a person sees and does.
 *
 * R-88 is the rule most of this is about: the message says how to fix it, sits
 * next to its field, and appears when they leave the field or on save — not on
 * every key press. Being told the title is too short while typing the second
 * letter is noise, not help.
 */
// A catch-all so navigations in the component under test resolve. With no
// routes at all, router.navigate() rejects, and an unhandled rejection in one
// spec file leaks into the whole run — it poisoned the admin and board suites
// before this was added.
const ANY_ROUTE = [{ path: '**', children: [] }];

describe('writing a request', () => {
  const active = { id: 'c1', name: 'Bug', slug: 'bug', color: '#DC2626', isActive: true };
  const retired = { id: 'c9', name: 'Legacy', slug: 'legacy', color: '#78716C', isActive: false };

  function storeIn(state: string, over: Record<string, unknown> = {}) {
    return {
      state: signal(state),
      initial: signal(null),
      error: signal(null),
      isSaving: signal(false),
      load: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({ id: 'r-new' }),
      update: vi.fn().mockResolvedValue({ id: 'r1' }),
      remove: vi.fn().mockResolvedValue(true),
      ...over,
    };
  }

  const bootstrap = {
    activeCategories: signal([active]),
    categoryById: (id: string) => (id === 'c1' ? active : id === 'c9' ? retired : undefined),
  };

  async function renderForm(store: ReturnType<typeof storeIn>, id?: string) {
    await render(RequestForm, {
      providers: [provideRouter(ANY_ROUTE), { provide: BootstrapStore, useValue: bootstrap }],
      componentProviders: [{ provide: RequestFormStore, useValue: store }],
      inputs: id === undefined ? {} : { id },
    });
    return store;
  }

  describe('a new request', () => {
    it('asks for exactly the three things a person may choose (R-10)', async () => {
      await renderForm(storeIn('ready'));

      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      // No status: the server sets it, and a person can never send one (R-11).
      expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
    });

    it('offers only the categories still open for picking (R-45)', async () => {
      await renderForm(storeIn('ready'));

      const select = screen.getByLabelText('Category');
      // The placeholder plus the one active category. Not the retired one.
      expect(select.querySelectorAll('option')).toHaveLength(2);
      expect(screen.queryByRole('option', { name: 'Legacy' })).not.toBeInTheDocument();
    });

    it('says nothing while somebody is still typing (R-88)', async () => {
      await renderForm(storeIn('ready'));

      await userEvent.type(screen.getByLabelText('Title'), 'Dark');

      expect(screen.queryByText(/at least 5 letters/i)).not.toBeInTheDocument();
    });

    it('says how to fix it once they leave the field', async () => {
      await renderForm(storeIn('ready'));

      await userEvent.type(screen.getByLabelText('Title'), 'Dark');
      await userEvent.tab();

      expect(screen.getByText(/at least 5 letters/i)).toBeInTheDocument();
    });

    it('does not save, and says what is wrong, when Save is pressed too early', async () => {
      const store = await renderForm(storeIn('ready'));

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(store.create).not.toHaveBeenCalled();
      expect(screen.getByText(/give the request a title/i)).toBeInTheDocument();
      expect(screen.getByText(/describe what you are asking for/i)).toBeInTheDocument();
      expect(screen.getByText(/pick a category before saving/i)).toBeInTheDocument();
    });

    /** R-112: the cursor goes to the first bad field. */
    it('puts the cursor in the first field that is wrong', async () => {
      await renderForm(storeIn('ready'));

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByLabelText('Title')).toHaveFocus();
    });

    it('ties each message to its field for a screen reader', async () => {
      await renderForm(storeIn('ready'));

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      const title = screen.getByLabelText('Title');
      expect(title).toHaveAttribute('aria-invalid', 'true');
      expect(title).toHaveAttribute('aria-describedby', 'title-error');
    });

    it('saves the three fields once they are all good', async () => {
      const store = await renderForm(storeIn('ready'));

      await userEvent.type(screen.getByLabelText('Title'), 'Dark mode');
      await userEvent.type(screen.getByLabelText('Description'), 'It is painful at night.');
      await userEvent.selectOptions(screen.getByLabelText('Category'), 'c1');
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(store.create).toHaveBeenCalledWith({
        title: 'Dark mode',
        description: 'It is painful at night.',
        categoryId: 'c1',
      });
    });

    /** SRS 15.3: two fast clicks on Save -> only one request is made. */
    it('disables Save while it is saving', async () => {
      await renderForm(storeIn('ready', { isSaving: signal(true) }));

      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });

  describe('when the server refuses', () => {
    /** SRS 15.3: the text they wrote is kept, and the message names the time. */
    it('names the time they may try again, and says nothing was lost', async () => {
      await renderForm(
        storeIn('ready', {
          error: signal({
            code: 'SUBMISSION_RATE_LIMITED',
            status: 429,
            requestId: 'r',
            isRetryable: false,
            retryAt: new Date('2026-08-30T14:00:00.000Z'),
          }),
        }),
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/you can send another at/i);
      expect(alert).toHaveTextContent(/nothing you wrote has been lost/i);
    });

    it('keeps what was typed on screen when saving fails', async () => {
      const store = storeIn('ready', {
        create: vi.fn().mockResolvedValue(null),
        error: signal({ code: 'INTERNAL_ERROR', status: 500, requestId: 'r', isRetryable: true }),
      });
      await renderForm(store);

      await userEvent.type(screen.getByLabelText('Title'), 'Dark mode');
      await userEvent.type(screen.getByLabelText('Description'), 'It is painful at night.');
      await userEvent.selectOptions(screen.getByLabelText('Category'), 'c1');
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByLabelText('Title')).toHaveValue('Dark mode');
      expect(screen.getByRole('alert')).toHaveTextContent(/still here/i);
    });
  });

  describe('editing', () => {
    /** SRS 15.2: a clear message, and no form. */
    it('shows no form at all for a request that is not mine', async () => {
      await renderForm(storeIn('notAllowed'), 'r1');

      expect(screen.getByText(/cannot edit this request/i)).toBeInTheDocument();
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    });

    it('says so when the request has gone', async () => {
      await renderForm(storeIn('missing'), 'r1');

      expect(screen.getByText(/does not exist/i)).toBeInTheDocument();
    });

    /** SRS 15.3: the category was retired while the form was open. */
    it('asks for another category when the one it used was retired', async () => {
      await renderForm(
        storeIn('ready', {
          initial: signal({ title: 'Old', description: 'Old thing here.', categoryId: 'c9' }),
        }),
        'r1',
      );

      expect(screen.getByText(/has been retired/i)).toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    it('is not offered while writing a new request', async () => {
      await renderForm(storeIn('ready'));

      expect(screen.queryByRole('button', { name: /delete request/i })).not.toBeInTheDocument();
    });

    /** R-91: asks first, names the thing, and says what will be lost. */
    it('asks first, naming the request and what goes with it', async () => {
      const store = await renderForm(
        storeIn('ready', {
          initial: signal({ title: 'Dark mode', description: 'x'.repeat(20), categoryId: 'c1' }),
        }),
        'r1',
      );

      await userEvent.click(screen.getByRole('button', { name: /delete request/i }));

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent(/dark mode/i);
      expect(dialog).toHaveTextContent(/votes and all of its comments/i);
      // Nothing has happened yet: one click cannot delete.
      expect(store.remove).not.toHaveBeenCalled();
    });

    it('deletes only after the second, explicit confirmation', async () => {
      const store = await renderForm(
        storeIn('ready', {
          initial: signal({ title: 'Dark mode', description: 'x'.repeat(20), categoryId: 'c1' }),
        }),
        'r1',
      );

      await userEvent.click(screen.getByRole('button', { name: /delete request/i }));
      await userEvent.click(screen.getByRole('button', { name: /delete it/i }));

      expect(store.remove).toHaveBeenCalledWith('r1');
    });

    it('lets them keep it', async () => {
      const store = await renderForm(
        storeIn('ready', {
          initial: signal({ title: 'Dark mode', description: 'x'.repeat(20), categoryId: 'c1' }),
        }),
        'r1',
      );

      await userEvent.click(screen.getByRole('button', { name: /delete request/i }));
      await userEvent.click(screen.getByRole('button', { name: /keep it/i }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(store.remove).not.toHaveBeenCalled();
    });
  });
});
