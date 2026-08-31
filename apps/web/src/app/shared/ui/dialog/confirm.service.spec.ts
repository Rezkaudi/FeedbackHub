import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';

describe('the confirm service', () => {
  function service(): ConfirmService {
    return TestBed.inject(ConfirmService);
  }

  it('resolves true when the caller responds true', async () => {
    const confirm = service();
    const promise = confirm.ask({ title: 'Delete it?', message: 'This cannot be undone.' });

    expect(confirm.request()?.title).toBe('Delete it?');
    confirm.respond(true);

    expect(await promise).toBe(true);
    expect(confirm.request()).toBeNull();
  });

  it('resolves false when the caller cancels', async () => {
    const confirm = service();
    const promise = confirm.ask({ title: 'Delete it?', message: 'This cannot be undone.' });

    confirm.respond(false);

    expect(await promise).toBe(false);
  });

  it('carries a danger tone through to the request', () => {
    const confirm = service();
    void confirm.ask({ title: 'Delete it?', message: 'Gone for good.', tone: 'danger' });

    expect(confirm.request()?.tone).toBe('danger');
    confirm.respond(false);
  });

  it('falls back to a default label when none is given', () => {
    const confirm = service();
    void confirm.ask({ title: 'Delete it?', message: 'Gone for good.' });

    expect(confirm.request()?.confirmLabel).toBe('Delete');
    expect(confirm.request()?.cancelLabel).toBe('Cancel');
    confirm.respond(false);
  });
});
