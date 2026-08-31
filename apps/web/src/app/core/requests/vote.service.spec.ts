import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VoteService, type Votable, type VotePatch } from './vote.service';

describe('voting on a request', () => {
  let backend: HttpTestingController;
  let voteService: VoteService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    voteService = TestBed.inject(VoteService);
  });

  afterEach(() => backend.verify());

  function item(over: Partial<Votable> = {}): Votable {
    return { id: 'r1', voteCount: 4, viewerHasVoted: false, ...over };
  }

  it('moves the count first, then replaces it with the server answer', async () => {
    let patched: VotePatch | null = null;
    const promise = voteService.vote(item(), (patch) => (patched = patch));

    expect(patched).toEqual({ viewerHasVoted: true, voteCount: 5 });

    backend.expectOne('/v1/requests/r1/vote').flush({ viewerHasVoted: true, voteCount: 9 });
    await promise;

    expect(patched).toEqual({ viewerHasVoted: true, voteCount: 9 });
  });

  it('un-votes with a delete when the viewer already voted', async () => {
    const promise = voteService.vote(item({ viewerHasVoted: true }), () => {});

    backend.expectOne((req) => req.method === 'DELETE' && req.url === '/v1/requests/r1/vote').flush({
      viewerHasVoted: false,
      voteCount: 3,
    });
    await promise;
  });

  it('a second click while one is in flight does nothing', async () => {
    let calls = 0;
    const apply = () => calls++;

    const first = voteService.vote(item(), apply);
    const second = voteService.vote(item(), apply);

    await expect(second).resolves.toBeNull();
    backend.expectOne('/v1/requests/r1/vote').flush({ viewerHasVoted: true, voteCount: 5 });
    await first;

    expect(calls).toBe(2);
  });

  it('puts the count back exactly as it was on failure, and reports the error', async () => {
    let patched: VotePatch | null = null;
    const before = item({ voteCount: 4, viewerHasVoted: false });

    const promise = voteService.vote(before, (patch) => (patched = patch));

    backend.expectOne('/v1/requests/r1/vote').flush(
      { error: { code: 'VOTE_RATE_LIMITED', message: 'Too many votes', requestId: 'req-1' } },
      { status: 429, statusText: 'Too Many Requests' },
    );

    const error = await promise;

    expect(patched).toEqual({ viewerHasVoted: false, voteCount: 4 });
    expect(error?.code).toBe('VOTE_RATE_LIMITED');
  });

  it('reports a 404 when the request was deleted mid-vote', async () => {
    const promise = voteService.vote(item(), () => {});

    backend.expectOne('/v1/requests/r1/vote').flush(
      { error: { code: 'NOT_FOUND', message: 'Gone', requestId: 'req-2' } },
      { status: 404, statusText: 'Not Found' },
    );

    const error = await promise;
    expect(error?.status).toBe(404);
  });
});
