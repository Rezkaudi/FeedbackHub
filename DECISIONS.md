# DECISIONS

The choices that mattered. Each one: the problem, the other options, what was
picked, and what it costs.

The file runs from D-01 upward, and the numbers ascend inside every section. A
few sit with their topic rather than with their number — D-25 with the other
security decisions, D-24 with the data model, D-44 with the tests — because the
topic is how anyone actually looks for them.

Numbers are **never renumbered.** `D-nn` is quoted 62 times outside this file —
in source comments, the CI workflow, README.md, SCOPE.md and commit messages —
so a number means one thing for ever. That is why there are gaps: a decision
dropped during the SRS revisions keeps its number. D-03 and D-06 are one
decision written once, under a single heading.

A decision that was later replaced is kept, with a pointer to the one that
replaced it. Small day-to-day UI choices are in the Git history, not here.

---

## Security and sessions

### D-01 — Tokens live in cookies the browser cannot read

**Context.** The SPA needs a session; tokens must not be stealable by a script.
**Options.** Access token in memory with a refresh cookie; both in
`localStorage`; both in httpOnly cookies.
**Decision.** Both in httpOnly, `SameSite` cookies. The browser never holds a
token at all.
**Consequences.** Good: an XSS cannot read the session, and the front end has no
token code. Bad: it needs the same domain, and a session cannot be revoked
server-side — the token stays valid until it expires.

### D-02 — `SameSite` plus an `Origin` check, no CSRF token

**Context.** Cookie auth invites CSRF.
**Options.** A CSRF token pair, or `SameSite` plus an origin allowlist.
**Decision.** `SameSite` cookies, plus a guard that refuses any write whose
`Origin` is not on the allowlist. `AUTH_ALLOWED_ORIGINS` has no default; empty
or `*` stops the boot.
**Consequences.** Good: no token plumbing, and one clear place to read the rule.
Bad: it only holds while the site and the API share a domain. Split them and a
CSRF token has to come back.

### D-25 — The guard chain is composed at the root, not in the shared kernel

**Context.** The guard chain is shared, so it looked like shared-kernel code.
But its first link answers "who is signed in", and that answer belongs to the
`identity` module — and the shared kernel may never depend on a module.
**Options.** Let the shared kernel import `identity` and drop the seam. Move the
whole chain inside `identity`. Keep the guard classes shared, and register them
at the composition root.
**Decision.** The third. `shared/http/` holds the guard classes and a
`CurrentUserSource` port; `AppModule` binds that port and registers the three
guards in order.
**Consequences.** Good: the seam survives, and the order of the chain is
declared in exactly one place. Bad: the wiring sits away from the guards, so
both files carry a comment pointing at the other.

---

## Configuration

### Where each setting lives (D-03, D-06)

**Context.** Settings come from three places: the code, the app, and the person.
**Options.** Everything in the environment; everything in the database;
a split.
**Decision.** The environment holds addresses, secrets and cookie mechanics
only. Product settings live in the database. Resolution is code default → app
setting → user override, and the front end receives the result of that in a
single `/v1/bootstrap` call.
**Consequences.** Good: an admin changes product behaviour with no redeploy, and
the SPA starts with one request instead of a chain. Bad: `/v1/bootstrap` is a
wide response and a single point of failure at start-up, and a saved change has
to be written back into the snapshot to avoid a page refresh (D-85).

---

## Data model

### D-04 — Board paging uses `page` and `pageSize`, with no maximum

**Context.** The brief never names the parameters.
**Options.** Cursor paging, or offset paging.
**Decision.** Offset paging, `page` and `pageSize`, because the board shows page
numbers.
**Consequences.** Good: simple and matches the UI. Bad: deep pages get slower,
and with no ceiling a caller can ask for everything. The ceiling should return.

### D-05 — Comments are flat, newest first, read with a cursor

**Context.** Comments grow without bound on a busy request.
**Options.** Threads with replies, or a flat list.
**Decision.** Flat, newest first, cursor paging on `(created_at, id)` descending.
**Consequences.** Good: stable order while new comments arrive, and one index
serves it. Bad: no replies, so long discussions lose their shape.

### D-07 — Email preferences are two boolean columns

**Context.** Two email events exist: a comment on my request, and a status
change.
**Options.** A preferences table keyed by event, or two columns.
**Decision.** Two columns on `user_settings`.
**Consequences.** Good: trivial to read and to default. Bad: a third event means
a migration; a table would not.

### D-08 — No status-history table

**Context.** An early draft invented one.
**Options.** Keep it, or drop it.
**Decision.** Drop it. "History" in the brief always means Git history, and
nothing in the product reads a status log.
**Consequences.** Good: one table fewer and no dead writes. Bad: "who changed
this, and when" cannot be answered. See D-12.

### D-09 — One real feature flag, in `app_settings`

**Context.** The brief wants at least one flag that visibly changes behavior.
**Options.** A flag in the environment, or a flag in the database.
**Decision.** `feature_comments_enabled` in the database, default true. Toggling
it hides comments for everyone, and the API refuses comment writes too.
**Consequences.** Good: one switch, visible everywhere, changed with no restart,
and enforced on the server rather than in the UI. Bad: a flag read on the write
path, and no per-user or gradual rollout.

### D-11 — Search runs at read time, with `ILIKE`

**Context.** The board is searchable by text.
**Options.** A trigram or full-text index with ranking, or a plain `ILIKE`.
**Decision.** `ILIKE` over title and description, no ranking.
**Consequences.** Good: no extra index, no tuning, no surprises. Bad: a
sequential scan that will not hold past a few thousand rows, and results are not
ordered by relevance.

### D-12 — No audit log, no `moderated_by` column

**Context.** Moderation and admin actions are invisible after the fact.
**Options.** Build an audit log, or leave it out and say so.
**Decision.** Leave it out. A real one is a table, a writer, a screen and a
retention rule, and the brief does not ask for it.
**Consequences.** Good: no half-built audit trail pretending to be one. Bad:
nothing to look at when someone asks who deleted a comment.

### D-14 — Categories and statuses read in `created_at` order

**Context.** A `sort_order` column would mean a drag-to-reorder screen and an
endpoint to go with it.
**Options.** Keep the column and build reordering; keep it and never use it;
drop it.
**Decision.** Drop it. The seed creates the rows in pipeline order, so the
statuses read New, Under Review, Planned, In Progress, Done, Declined.
**Consequences.** Good: the right order with no UI, no endpoint, no tests. Bad:
an admin cannot reorder the lists, and a status added later lands at the end
whatever it means.

### D-24 — Every rule is checked twice: in the DTO and in the database

**Context.** A rule like "a title is 5 to 120 letters" has two jobs: give a
person a useful message under the right field, and hold even when nobody asked
nicely.
**Options.** Check it in the DTO only, and trust the code to run first. Check it
in the database only, and translate the failure into a field message. Check it
in both.
**Decision.** Both, with different jobs. The DTO check produces the 400 and the
field message; the database CHECK holds when two writes land in the same second,
when a migration backfills, or when someone opens `psql`. The integration tests
bypass the use case and assert the *database* refuses, so a missing constraint
fails the build even though the DTO would have caught it in normal use.
**Consequences.** Good: the promise is as strong as it claims, and the message a
person sees is still the helpful one. Bad: the numbers live in two places — a
DTO and a migration — and changing one needs the other, with a migration. A rule
that needs other rows ("is this the last active category?") has no constraint to
write; there the use case is the only guard.

**Counts are never stored.** Vote count and comment count are counted from the
rows on every read, so they cannot drift. If it ever becomes slow, a counter
goes behind the same repository port.

---

## Rate limits

### D-15 — Three sliding windows, changeable while the app runs

**Context.** Sign-ups, submissions and votes all need limits.
**Options.** Fixed numbers in the environment, or numbers in the database.
**Decision.** Six columns in `app_settings`, six numbers an admin can change
with no restart. Redis holds the windows.
**Consequences.** Good: tuned live, and the numbers are honest guesses that can
be corrected. Bad: one more read on the write path, and comments and invitations
still have no limit.

---

## Stack and architecture

### D-16 — Angular 20, standalone components, signals, Tailwind

**Superseded by D-36.** The original plan; the version moved before release.

### D-17 — Node.js 22 with NestJS 11

**Context.** Node was preferred by the brief. A framework was still a choice.
**Options.** Express by hand, Fastify, NestJS.
**Decision.** NestJS. Its module system matches D-18 one-to-one, and DI makes
ports and adapters natural rather than ceremonial.
**Consequences.** Good: structure, guards, validation pipes and OpenAPI
generation come for free. Bad: decorators and DI are a real learning cost

### D-18 — A modular monolith, not a set of services

**Context.** The brief prefers a service split but asks for reasoning more than
a shape.
**Options.** (a) Services per domain — requests, comments, identity, settings.
(b) One app, no internal structure. (c) One deployable, with enforced walls.
**Decision.** (c). Nine modules — identity, requests, votes, comments,
taxonomy, settings, invitations, notifications, bootstrap — each with
`domain / application / infrastructure / http`. A module talks to another only
through a published contract. `dependency-cruiser` fails CI if that is broken.
Email is the one thing split out, as a worker process on the same image,
because it is slow and must not block a request.
**Consequences.** Good: one thing to deploy, one transaction, no network
between features, and the seams are real and machine-checked — a split later is
a move, not a rewrite. Bad: no independent scaling or independent deploys, and
the walls hold only because CI enforces them; nothing physical stops a shortcut.

### D-19 — PostgreSQL 16 and Prisma 6, with raw SQL for the board

**Context.** The board query filters, searches, sorts, pages and counts votes
and comments at once.
**Options.** Prisma for everything; an ORM with a richer query builder; raw SQL
throughout.
**Decision.** Prisma for the normal reads and writes, one hand-written SQL query
for the board, both behind the same repository port.
**Consequences.** Good: typed models and migrations everywhere, plus one fast
query where it matters. Bad: two styles in one repository, and the raw query is
not type-checked against the schema — it has its own tests.

### D-20 — Redis 7 for shared state

**Context.** Rate limits and the email queue must work with more than one API
replica.
**Options.** In-process memory, a database table, Redis.
**Decision.** Redis. Sliding windows for the limits, a list for the email queue.
**Consequences.** Good: correct with two replicas, and cheap. Bad: one more
service to run, and a dependency the readiness probe must report.

### D-21 — Keycloak, self-hosted in this repository

**Context.** The brief says use an open-source identity provider, and do not
write auth primitives.
**Options.** Auth0 or Clerk (hosted), Ory, Keycloak.
**Decision.** Keycloak, with the realm exported into the repo so `compose up`
brings a working client, roles and seeded accounts with no manual clicking.
**Consequences.** Good: nothing to sign up for, a reviewer can sign in
immediately, and social providers are configuration. Bad: Keycloak is heavy and
slow to boot, and the realm export is a large generated file to keep in step.
Bad, and bigger: **it has no webhooks.** Nothing calls us when something changes
there, so our copy of a person only catches up at their next sign-in. If someone
changes their email, is disabled, or is deleted inside Keycloak, our database
does not hear about it, and a disabled account keeps working here until its
token runs out. The ways around it are all work we did not do: poll the Admin
REST API, read the event stream, or write a Keycloak event-listener extension in
Java.

---

## Testing and building

### D-22 — Test-first, in four layers, with an end-to-end suite on top

**Context.** The brief sets no coverage target, but every rule that says "no"
needs a test proving the *server* says no.
**Options.** Write tests after the code and chase a coverage number. Write only
end-to-end tests. Drive the work test-first, in deliberate layers.
**Decision.** Red, green, refactor, for every numbered rule. Four layers:

1. **Unit** — domain and use cases, fake ports, no database.
2. **Integration** — repositories and database constraints, against real
   Postgres and Redis (Testcontainers).
3. **API** — the whole guard chain, through Supertest.
4. **Front end** — Angular Testing Library, through role, label and visible
   text only, never a CSS class.

On top of those, an end-to-end suite in a real browser against the full compose
stack, signing in for real through Keycloak.

**Consequences.** Good: the rule numbers are the test list, so the tests read as
the specification; a failure points at one layer; and only layer 2 can prove
"the database refuses it" — a mocked repository passes with the constraint
missing. Bad: a full run takes minutes, most of it starting containers, and
test-first on a UI that was later redesigned meant writing some tests twice.

### D-23 — Testcontainers finds the runtime by itself

**Context.** The machine runs rootless podman, CI runs Docker.
**Options.** A checked-in compose file for tests, or Testcontainers.
**Decision.** Testcontainers, which discovers the socket on its own.
**Consequences.** Good: the same command works on both. Bad: the cleanup
container cannot run rootless, so it is off — a killed run can leave a container
behind (`npm run test:clean`).

### D-26 — The Keycloak realm pins the user ids the seed expects

**Context.** A seeded request needs an author who also exists in Keycloak.
**Options.** Create users at first sign-in only, or pin ids in both places.
**Decision.** The realm export pins the accounts' subject ids, and the seed
writes those same ids into `users.external_id`.
**Consequences.** Good: the demo data belongs to real, signable-in accounts on
the very first run. Bad: two files must be edited together, and drifting them
silently creates duplicate accounts.

### D-44 — The end-to-end suite lifts the rate limits while it runs

**Context.** The sliding windows count every write left behind by every earlier
run against the same stack, so the third or fourth run of the suite in an hour
starts failing tests that have nothing to do with limits.
**Options.** Accept a few runs per hour. Rebuild the database for every run.
Share one request between specs. Lift the limits for the run and restore them.
**Decision.** Lift them in the global setup — written unconditionally, so a
crashed run that left small limits behind is still fixed — restore the shipped
defaults in the teardown, and give the rule its own spec
(`08-04-rate-limits.cy.ts`) that sets tiny limits with a short window and
watches the server refuse.
**Consequences.** Good: the suite runs as often as anyone wants, and the limits
are still proven. Bad: the suite writes application settings before it starts,
so a run killed part-way can leave the limits lifted, and every other spec runs
against a configuration no real deployment has. A fresh database per run was
cleaner and was rejected on time — a compose teardown plus a full Keycloak boot
per run.

---

## The front end

### D-36 — Angular 22, and what that costs

**Context.** The newest Angular at the time of building.
**Options.** Angular 20 LTS-ish and safe, or 22 and current.
**Decision.** 22, standalone components, signals, Tailwind 4, Material 3 tokens.
**Consequences.** Good: no NgModules, signals instead of a store, current APIs.
Bad: Node 22.22.3+ is required or the CLI refuses to start, some libraries lag,
and answers found online are often for older versions.

### D-37 — A client-rendered SPA, not SSR

**Context.** Angular offers SSR.
**Options.** SSR, or a static build served by nginx.
**Decision.** Static build behind nginx, which also proxies `/v1` so the browser
sees one origin.
**Consequences.** Good: one runtime, simple image, and same-origin cookies
behave in development exactly as in production. Bad: a slower first paint, and
nothing for a search engine — acceptable for an internal signed-in tool.

### D-38 — Signals and small stores, not NgRx

**Context.** Shared state: the session, the start-up snapshot, the board.
**Options.** NgRx, a service with RxJS subjects, signals in small stores.
**Decision.** Signals, one store per area.
**Consequences.** Good: far less code, no boilerplate, easy to read.

### D-48 — The end-to-end suite is Cypress, not Playwright

**Context.** The suite was originally Playwright.
**Options.** Keep Playwright, or move to Cypress.
**Decision.** Cypress, and the suite was rewritten from scratch (D-100) rather
than patched, on `data-testid` selectors, organised by journey.
**Consequences.** Good: a stable selector contract, a readable structure, and
Keycloak's and Mailpit's REST APIs used as first-class test infrastructure. Bad:
a full rewrite cost real time, and Cypress needs `retries: 2` in run mode for
the real-Keycloak sign-in flow.

---

## Later changes and superseded decisions (D-32, D-51, D-76, D-85, D-91, D-100)

- **D-16 → D-36.** Angular 20 became Angular 22.
- **D-51 → D-100.** The Cypress suite was first left untouched after the UI
  redesign, and declared a known gap; it was later rewritten from scratch.
- **D-76.** Editing a request became a popup on the request page, and the
  `/requests/:id/edit` route was removed.
- **D-85.** A saved setting is written back into the start-up snapshot, so the
  UI updates without a browser refresh. Same session only — another person's
  change still needs a reload.
- **D-32.** The refresh cookie is scoped to `/v1/auth`, not to the refresh route
  alone. Scoped too narrowly, refresh and sign-out were both broken while every
  test passed.
- **D-91.** Every failed call turns its error code into words in one place, and
  field errors sit on the field. `CONFLICT` is the exception: one code covers
  several refusals, so the server's English sentence is shown as-is — which is
  why a few admin-only messages stay English in Arabic (SCOPE §3).
