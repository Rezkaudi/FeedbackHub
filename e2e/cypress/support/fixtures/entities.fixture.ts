import { api } from '../clients/api.client';
import { ADMIN } from './accounts';
import { stampedTitle } from '../utils/stamp';
import type { Account } from './accounts';
import type { CommentDto, Invitation, RequestDto, Category, Status } from '../utils/types';

/**
 * The registry lives on `Cypress.env()`, not a module-level variable.
 * Cypress bundles the support file and each spec file separately, so a plain
 * `let registry = []` at module scope ends up as two independent arrays —
 * one instance the spec's `makeRequest`/`makeComment`/... calls push into,
 * and a different, always-empty one that `drainCreated` (wired from
 * `support/e2e.ts`) reads from, silently cleaning nothing. `Cypress` itself
 * is the one true singleton shared by both bundles, so state that must cross
 * that boundary belongs on it.
 */
type EntityKind = 'request' | 'comment' | 'category' | 'status' | 'invitation';
interface TrackedEntity {
  readonly kind: EntityKind;
  readonly id: string;
}

const REGISTRY_KEY = '__e2eCreatedEntities';

function registry(): TrackedEntity[] {
  const existing = Cypress.env(REGISTRY_KEY) as TrackedEntity[] | undefined;
  if (existing) {
    return existing;
  }
  const created: TrackedEntity[] = [];
  Cypress.env(REGISTRY_KEY, created);
  return created;
}

function track(kind: EntityKind, id: string): void {
  registry().push({ kind, id });
}

function removeFor(entity: TrackedEntity): Cypress.Chainable<Cypress.Response<unknown>> {
  switch (entity.kind) {
    case 'request':
      return api.requests.remove(entity.id);
    case 'comment':
      return api.comments.remove(entity.id);
    case 'category':
      return api.taxonomy.categories.remove(entity.id);
    case 'status':
      return api.taxonomy.statuses.remove(entity.id);
    case 'invitation':
      return api.invitations.remove(entity.id);
  }
}

/** Deletes everything the current spec created, newest first, ignoring
 *  404/409 — a spec that dies mid-test still leaves the shared stack clean.
 *  Wired into a global `afterEach` in `support/e2e.ts`; specs never call this
 *  directly.
 *
 * Always signs in as ADMIN first: whichever persona a test ends on (often a
 * non-author, e.g. after a 403 check) may not be allowed to delete what was
 * created, but an admin always can (requests/comments: author-or-admin;
 * taxonomy/invitations: admin-only). */
export function drainCreated(): void {
  const toClean = [...registry()].reverse();
  Cypress.env(REGISTRY_KEY, []);
  if (toClean.length === 0) {
    return;
  }
  cy.signIn(ADMIN);
  for (const entity of toClean) {
    removeFor(entity);
  }
}

export function makeRequest(opts: {
  as?: Account;
  title?: string;
  description?: string;
  categoryId?: string;
} = {}): Cypress.Chainable<RequestDto> {
  if (opts.as) {
    cy.signIn(opts.as);
  }

  const create = (categoryId: string): Cypress.Chainable<RequestDto> =>
    api.requests
      .create({
        title: opts.title ?? stampedTitle(),
        description: opts.description ?? 'Created by the e2e suite for one scenario, then removed.',
        categoryId,
      })
      .then((request) => {
        track('request', request.id);
        return request;
      });

  if (opts.categoryId) {
    return create(opts.categoryId);
  }

  return api.bootstrap().then((boot) => {
    const category = boot.categories.find((c) => c.isActive) ?? boot.categories[0];
    if (!category) {
      throw new Error('makeRequest: no category available in bootstrap');
    }
    return create(category.id);
  });
}

export function makeComment(
  requestId: string,
  opts: { as?: Account; body?: string } = {},
): Cypress.Chainable<CommentDto> {
  if (opts.as) {
    cy.signIn(opts.as);
  }
  return api.comments.write(requestId, opts.body ?? 'A comment created by the e2e suite.').then((comment) => {
    track('comment', comment.id);
    return comment;
  });
}

export function makeCategory(opts: { name?: string; color?: string } = {}): Cypress.Chainable<Category> {
  cy.signIn(ADMIN);
  return api.taxonomy.categories
    .create({ name: opts.name ?? stampedTitle('cat'), color: opts.color ?? '#0b57d0' })
    .then((response) => {
      const category = response.body as Category;
      track('category', category.id);
      return category;
    });
}

export function makeStatus(opts: { name?: string; color?: string } = {}): Cypress.Chainable<Status> {
  cy.signIn(ADMIN);
  return api.taxonomy.statuses
    .create({ name: opts.name ?? stampedTitle('status'), color: opts.color ?? '#0b57d0' })
    .then((response) => {
      const status = response.body as Status;
      track('status', status.id);
      return status;
    });
}

export function makeInvitation(email: string): Cypress.Chainable<Invitation> {
  cy.signIn(ADMIN);
  return api.invitations.create(email).then((response) => {
    const invitation = response.body as Invitation;
    track('invitation', invitation.id);
    return invitation;
  });
}
