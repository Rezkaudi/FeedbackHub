import type {
  AppSettings,
  Bootstrap,
  BoardPage,
  Category,
  CommentDto,
  CommentPage,
  Invitation,
  Me,
  MySettings,
  RequestDto,
  Status,
  VoteState,
} from '../utils/types';

/** Every write carries an `Origin` header from an allowed web address — the
 *  API's OriginGuard refuses any POST/PUT/PATCH/DELETE whose Origin is missing
 *  or unknown, and `cy.request()` sends none of its own (R-3g). Pass
 *  `origin: false` to deliberately omit it, or a string to forge a foreign one
 *  — both are exercised by the hardening spec. */
export interface ApiOptions {
  readonly failOnStatusCode?: boolean;
  readonly origin?: string | false;
}

function appOrigin(): string {
  return String(Cypress.config('baseUrl') ?? 'http://localhost:4200');
}

function path(p: string): string {
  return `/v1${p}`;
}

function writeHeaders(options?: ApiOptions): Record<string, string> {
  if (options?.origin === false) {
    return {};
  }
  return { origin: options?.origin ?? appOrigin() };
}

export function apiGet<T = unknown>(p: string, options?: ApiOptions): Cypress.Chainable<Cypress.Response<T>> {
  return cy.request<T>({
    method: 'GET',
    url: path(p),
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}

export function apiPost<T = unknown>(
  p: string,
  body?: unknown,
  options?: ApiOptions,
): Cypress.Chainable<Cypress.Response<T>> {
  return cy.request<T>({
    method: 'POST',
    url: path(p),
    body: body as Cypress.RequestBody,
    headers: writeHeaders(options),
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}

export function apiPatch<T = unknown>(
  p: string,
  body?: unknown,
  options?: ApiOptions,
): Cypress.Chainable<Cypress.Response<T>> {
  return cy.request<T>({
    method: 'PATCH',
    url: path(p),
    body: body as Cypress.RequestBody,
    headers: writeHeaders(options),
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}

export function apiDelete<T = unknown>(p: string, options?: ApiOptions): Cypress.Chainable<Cypress.Response<T>> {
  return cy.request<T>({
    method: 'DELETE',
    url: path(p),
    headers: writeHeaders(options),
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}

export interface BoardQuery {
  search?: string;
  statusIds?: readonly string[];
  categoryIds?: readonly string[];
  mine?: boolean;
  sort?: 'newest' | 'oldest' | 'most_votes' | 'most_comments';
  page?: number;
  pageSize?: number;
}

function boardQueryString(q?: BoardQuery): string {
  if (!q) {
    return '';
  }
  const params = new URLSearchParams();
  // Compare against `undefined`, not truthiness: `page: 0` / `pageSize: 0` /
  // `mine: false` are deliberate values a caller (esp. a boundary test) may
  // need to send, and a falsy check would silently drop them from the query.
  if (q.search !== undefined) params.set('search', q.search);
  if (q.mine !== undefined) params.set('mine', String(q.mine));
  if (q.sort !== undefined) params.set('sort', q.sort);
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  for (const id of q.statusIds ?? []) params.append('statusIds', id);
  for (const id of q.categoryIds ?? []) params.append('categoryIds', id);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const api = {
  bootstrap: (): Cypress.Chainable<Bootstrap> => apiGet<Bootstrap>('/bootstrap').its('body'),

  me: {
    read: (): Cypress.Chainable<Me> => apiGet<Me>('/me').its('body'),
    update: (patch: Partial<Pick<Me, 'displayName' | 'avatarUrl'>>): Cypress.Chainable<Me> =>
      apiPatch<Me>('/me', patch).its('body'),
    remove: (opts?: ApiOptions): Cypress.Chainable<Cypress.Response<unknown>> =>
      apiDelete('/me', { failOnStatusCode: false, ...opts }),
  },

  requests: {
    list: (q?: BoardQuery, opts?: ApiOptions): Cypress.Chainable<BoardPage> =>
      apiGet<BoardPage>(`/requests${boardQueryString(q)}`, opts).its('body'),
    listRaw: (q?: BoardQuery): Cypress.Chainable<Cypress.Response<BoardPage>> =>
      apiGet<BoardPage>(`/requests${boardQueryString(q)}`, { failOnStatusCode: false }),
    create: (input: { title: string; description: string; categoryId: string }): Cypress.Chainable<RequestDto> =>
      apiPost<RequestDto>('/requests', input).its('body'),
    createRaw: (
      input: Record<string, unknown>,
      opts?: ApiOptions,
    ): Cypress.Chainable<Cypress.Response<RequestDto>> =>
      apiPost<RequestDto>('/requests', input, { failOnStatusCode: false, ...opts }),
    read: (id: string, opts?: ApiOptions): Cypress.Chainable<RequestDto> =>
      apiGet<RequestDto>(`/requests/${id}`, opts).its('body'),
    readRaw: (id: string): Cypress.Chainable<Cypress.Response<RequestDto>> =>
      apiGet<RequestDto>(`/requests/${id}`, { failOnStatusCode: false }),
    update: (id: string, patch: Record<string, unknown>, opts?: ApiOptions): Cypress.Chainable<RequestDto> =>
      apiPatch<RequestDto>(`/requests/${id}`, patch, opts).its('body'),
    updateRaw: (
      id: string,
      patch: Record<string, unknown>,
      opts?: ApiOptions,
    ): Cypress.Chainable<Cypress.Response<RequestDto>> =>
      apiPatch<RequestDto>(`/requests/${id}`, patch, { failOnStatusCode: false, ...opts }),
    remove: (id: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<unknown>> =>
      apiDelete(`/requests/${id}`, { failOnStatusCode: false, ...opts }),
    setStatus: (id: string, statusId: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<RequestDto>> =>
      apiPatch<RequestDto>(`/requests/${id}/status`, { statusId }, { failOnStatusCode: false, ...opts }),
    setPinned: (id: string, pinned: boolean, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<RequestDto>> =>
      apiPatch<RequestDto>(`/requests/${id}/pin`, { pinned }, { failOnStatusCode: false, ...opts }),
    vote: (id: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<VoteState>> =>
      apiPost<VoteState>(`/requests/${id}/vote`, undefined, { failOnStatusCode: false, ...opts }),
    unvote: (id: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<VoteState>> =>
      apiDelete<VoteState>(`/requests/${id}/vote`, { failOnStatusCode: false, ...opts }),
  },

  comments: {
    list: (
      requestId: string,
      q?: { limit?: number; cursor?: string },
      opts?: ApiOptions,
    ): Cypress.Chainable<CommentPage> => {
      const params = new URLSearchParams();
      if (q?.limit) params.set('limit', String(q.limit));
      if (q?.cursor) params.set('cursor', q.cursor);
      const qs = params.toString();
      return apiGet<CommentPage>(`/requests/${requestId}/comments${qs ? `?${qs}` : ''}`, opts).its('body');
    },
    listRaw: (requestId: string): Cypress.Chainable<Cypress.Response<CommentPage>> =>
      apiGet<CommentPage>(`/requests/${requestId}/comments`, { failOnStatusCode: false }),
    write: (requestId: string, body: string, opts?: ApiOptions): Cypress.Chainable<CommentDto> =>
      apiPost<CommentDto>(`/requests/${requestId}/comments`, { body }, opts).its('body'),
    writeRaw: (
      requestId: string,
      payload: Record<string, unknown>,
      opts?: ApiOptions,
    ): Cypress.Chainable<Cypress.Response<CommentDto>> =>
      apiPost<CommentDto>(`/requests/${requestId}/comments`, payload, { failOnStatusCode: false, ...opts }),
    edit: (id: string, body: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<CommentDto>> =>
      apiPatch<CommentDto>(`/comments/${id}`, { body }, { failOnStatusCode: false, ...opts }),
    remove: (id: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<unknown>> =>
      apiDelete(`/comments/${id}`, { failOnStatusCode: false, ...opts }),
    pending: (opts?: ApiOptions): Cypress.Chainable<Cypress.Response<CommentDto[]>> =>
      apiGet<CommentDto[]>('/admin/comments/pending', { failOnStatusCode: false, ...opts }),
    approve: (id: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<CommentDto>> =>
      apiPost<CommentDto>(`/admin/comments/${id}/approve`, undefined, { failOnStatusCode: false, ...opts }),
    reject: (id: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<unknown>> =>
      apiPost(`/admin/comments/${id}/reject`, undefined, { failOnStatusCode: false, ...opts }),
  },

  taxonomy: {
    read: (opts?: ApiOptions): Cypress.Chainable<{ categories: Category[]; statuses: Status[] }> =>
      apiGet<{ categories: Category[]; statuses: Status[] }>('/taxonomy', { failOnStatusCode: false, ...opts }).its(
        'body',
      ),
    categories: {
      create: (input: { name: string; color: string; description?: string }, opts?: ApiOptions) =>
        apiPost<Category>('/taxonomy/categories', input, { failOnStatusCode: false, ...opts }),
      update: (id: string, patch: Record<string, unknown>, opts?: ApiOptions) =>
        apiPatch<Category>(`/taxonomy/categories/${id}`, patch, { failOnStatusCode: false, ...opts }),
      retire: (id: string, opts?: ApiOptions) =>
        apiPost(`/taxonomy/categories/${id}/retire`, undefined, { failOnStatusCode: false, ...opts }),
      remove: (id: string, opts?: ApiOptions) =>
        apiDelete(`/taxonomy/categories/${id}`, { failOnStatusCode: false, ...opts }),
    },
    statuses: {
      create: (input: { name: string; color: string }, opts?: ApiOptions) =>
        apiPost<Status>('/taxonomy/statuses', input, { failOnStatusCode: false, ...opts }),
      update: (id: string, patch: Record<string, unknown>, opts?: ApiOptions) =>
        apiPatch<Status>(`/taxonomy/statuses/${id}`, patch, { failOnStatusCode: false, ...opts }),
      retire: (id: string, opts?: ApiOptions) =>
        apiPost(`/taxonomy/statuses/${id}/retire`, undefined, { failOnStatusCode: false, ...opts }),
      makeDefault: (id: string, opts?: ApiOptions) =>
        apiPost(`/taxonomy/statuses/${id}/make-default`, undefined, { failOnStatusCode: false, ...opts }),
      remove: (id: string, opts?: ApiOptions) =>
        apiDelete(`/taxonomy/statuses/${id}`, { failOnStatusCode: false, ...opts }),
    },
  },

  settings: {
    app: {
      read: (opts?: ApiOptions): Cypress.Chainable<AppSettings> =>
        apiGet<AppSettings>('/settings/app', opts).its('body'),
      readRaw: (): Cypress.Chainable<Cypress.Response<AppSettings>> =>
        apiGet<AppSettings>('/settings/app', { failOnStatusCode: false }),
      update: (patch: Partial<AppSettings>, opts?: ApiOptions): Cypress.Chainable<AppSettings> =>
        apiPatch<AppSettings>('/settings/app', patch, opts).its('body'),
      updateRaw: (
        patch: Record<string, unknown>,
        opts?: ApiOptions,
      ): Cypress.Chainable<Cypress.Response<AppSettings>> =>
        apiPatch<AppSettings>('/settings/app', patch, { failOnStatusCode: false, ...opts }),
    },
    me: {
      read: (opts?: ApiOptions): Cypress.Chainable<MySettings> =>
        apiGet<MySettings>('/settings/me', opts).its('body'),
      update: (patch: Partial<MySettings>, opts?: ApiOptions): Cypress.Chainable<MySettings> =>
        apiPatch<MySettings>('/settings/me', patch, opts).its('body'),
      updateRaw: (
        patch: Record<string, unknown>,
        opts?: ApiOptions,
      ): Cypress.Chainable<Cypress.Response<MySettings>> =>
        apiPatch<MySettings>('/settings/me', patch, { failOnStatusCode: false, ...opts }),
    },
  },

  invitations: {
    list: (opts?: ApiOptions): Cypress.Chainable<Cypress.Response<Invitation[]>> =>
      apiGet<Invitation[]>('/invitations', { failOnStatusCode: false, ...opts }),
    create: (email: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<Invitation>> =>
      apiPost<Invitation>('/invitations', { email }, { failOnStatusCode: false, ...opts }),
    remove: (id: string, opts?: ApiOptions): Cypress.Chainable<Cypress.Response<unknown>> =>
      apiDelete(`/invitations/${id}`, { failOnStatusCode: false, ...opts }),
  },
};
