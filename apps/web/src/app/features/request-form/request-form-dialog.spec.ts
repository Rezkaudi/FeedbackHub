import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RequestFormDialog } from './request-form-dialog';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { ConfirmDialog } from '../../shared/ui/dialog/confirm-dialog';

afterEach(() => {
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.removeAttribute('open'));
});

const ANY_ROUTE = [{ path: '**', children: [] }];
const TEMPLATE =
  '<fh-request-form-dialog [open]="true" [id]="id" (gone)="onGone()"></fh-request-form-dialog><fh-confirm-dialog></fh-confirm-dialog>';

describe('the request form dialog', () => {
  const active = { id: 'c1', name: 'Bug', slug: 'bug', color: '#DC2626', isActive: true };
  const retired = { id: 'c9', name: 'Legacy', slug: 'legacy', color: '#78716C', isActive: false };

  const refreshTaxonomy = vi.fn().mockResolvedValue(undefined);
  const bootstrap = {
    activeCategories: signal([active]),
    categoryById: (id: string) => (id === 'c1' ? active : id === 'c9' ? retired : undefined),
    refreshTaxonomy,
  };

  const onGone = vi.fn();

  beforeEach(() => {
    refreshTaxonomy.mockClear();
    onGone.mockClear();
  });

  async function renderCreate() {
    const utils = await render(TEMPLATE, {
      imports: [RequestFormDialog, ConfirmDialog],
      componentProperties: { id: undefined as string | undefined, onGone },
      providers: [
        provideRouter(ANY_ROUTE),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BootstrapStore, useValue: bootstrap },
      ],
    });
    return { backend: TestBed.inject(HttpTestingController), ...utils };
  }

  async function renderEdit(id: string, requestOver: Record<string, unknown> = {}) {
    const { backend, fixture } = await renderCreate();
    fixture.componentInstance.id = id;
    fixture.detectChanges();

    backend.expectOne(`/v1/requests/${id}`).flush({
      id,
      title: 'Dark mode',
      description: 'x'.repeat(20),
      categoryId: 'c1',
      statusId: 's1',
      authorName: 'Sam',
      authorAvatarUrl: null,
      isPinned: false,
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
      voteCount: 4,
      commentCount: 0,
      viewerHasVoted: false,
      isMine: true,
      ...requestOver,
    });
    await Promise.resolve();
    fixture.detectChanges();

    return backend;
  }

  it('asks for exactly the three things a person may choose (R-10)', async () => {
    await renderCreate();

    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Category' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
  });

  it('offers only the categories still open for picking (R-45)', async () => {
    await renderCreate();

    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Bug' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Legacy' })).not.toBeInTheDocument();
  });

  it('says nothing while somebody is still typing, then says how to fix it once they leave (R-88)', async () => {
    await renderCreate();

    await userEvent.type(screen.getByLabelText('Title'), 'Dark');
    expect(screen.queryByText(/at least 5 letters/i)).not.toBeInTheDocument();

    await userEvent.tab();
    expect(screen.getByText(/at least 5 letters/i)).toBeInTheDocument();
  });

  it('does not save, and says what is wrong, when Save is pressed too early', async () => {
    await renderCreate();

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText(/give the request a title/i)).toBeInTheDocument();
    expect(screen.getByText(/describe what you are asking for/i)).toBeInTheDocument();
    expect(screen.getByText(/pick a category before saving/i)).toBeInTheDocument();

    const title = screen.getByLabelText('Title');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAttribute('aria-describedby', 'title-error');
  });

  it('saves the three fields once they are all good', async () => {
    const { backend } = await renderCreate();

    await userEvent.type(screen.getByLabelText('Title'), 'Dark mode');
    await userEvent.type(screen.getByLabelText('Description'), 'It is painful at night.');
    await userEvent.click(screen.getByRole('radio', { name: 'Bug' }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    const request = backend.expectOne('/v1/requests');
    expect(request.request.body).toEqual({
      title: 'Dark mode',
      description: 'It is painful at night.',
      categoryId: 'c1',
    });
    request.flush({ id: 'r-new' });
  });

  it('names the time they may try again, and says nothing was lost', async () => {
    const { backend, fixture } = await renderCreate();

    await userEvent.type(screen.getByLabelText('Title'), 'Dark mode');
    await userEvent.type(screen.getByLabelText('Description'), 'It is painful at night.');
    await userEvent.click(screen.getByRole('radio', { name: 'Bug' }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    backend.expectOne('/v1/requests').flush(
      { error: { code: 'SUBMISSION_RATE_LIMITED', message: 'x', requestId: 'r', retryAt: '2026-08-30T14:00:00.000Z' } },
      { status: 429, statusText: 'Too Many Requests' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/you can send another at/i);
    expect(alert).toHaveTextContent(/nothing you wrote has been lost/i);
    expect(screen.getByLabelText('Title')).toHaveValue('Dark mode');
  });

  it('puts the category refusal on the category field and re-reads the taxonomy', async () => {
    const { backend, fixture } = await renderCreate();

    await userEvent.type(screen.getByLabelText('Title'), 'Dark mode');
    await userEvent.type(screen.getByLabelText('Description'), 'It is painful at night.');
    await userEvent.click(screen.getByRole('radio', { name: 'Bug' }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    backend.expectOne('/v1/requests').flush(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'The submitted values are not valid.',
          requestId: 'r',
          fields: { categoryId: 'CATEGORY_MUST_EXIST_AND_BE_ACTIVE' },
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Dark mode');
    await waitFor(() => expect(refreshTaxonomy).toHaveBeenCalled());
  });

  it('shows no form at all for a request that is not mine', async () => {
    const { backend, fixture } = await renderCreate();
    fixture.componentInstance.id = 'r1';
    fixture.detectChanges();

    backend.expectOne('/v1/requests/r1').flush({
      id: 'r1',
      title: 'Dark mode',
      description: 'x'.repeat(20),
      categoryId: 'c1',
      statusId: 's1',
      authorName: 'Sam',
      authorAvatarUrl: null,
      isPinned: false,
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
      voteCount: 4,
      commentCount: 0,
      viewerHasVoted: false,
      isMine: false,
    });
    await Promise.resolve();
    fixture.detectChanges();

    expect(screen.getByText(/cannot edit this request/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('says so when the request has gone', async () => {
    const { backend, fixture } = await renderCreate();
    fixture.componentInstance.id = 'r1';
    fixture.detectChanges();

    backend.expectOne('/v1/requests/r1').flush({}, { status: 404, statusText: 'Not Found' });
    await Promise.resolve();
    fixture.detectChanges();

    expect(screen.getByText(/does not exist/i)).toBeInTheDocument();
    expect(onGone).toHaveBeenCalled();
  });

  it('asks for another category when the one it used was retired', async () => {
    await renderEdit('r1', { categoryId: 'c9' });

    expect(screen.getByText(/has been retired/i)).toBeInTheDocument();
  });

  it('is not offered while writing a new request', async () => {
    await renderCreate();

    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it('is not offered while editing either — delete lives on the request page, not here', async () => {
    await renderEdit('r1', { title: 'Dark mode' });

    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });
});
