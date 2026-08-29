# DECISIONS

The 22 choices that mattered. Each one has four short parts:

- **Problem** — what we had to solve.
- **Options** — what else we could have picked.
- **We picked** — what we chose.
- **What we get** — what this buys us.

A decision that changes later gets a new number. The old one stays.

Rule numbers (R-nn) point into `references/SRS.pdf`.

---

## Security and sessions

### D-01 — Tokens live in cookies the browser cannot read
- **Problem** — Where to keep the access token and the refresh token after sign-in.
- **Options** — `localStorage`. A JavaScript variable. `HttpOnly` cookies. A session id with the tokens on the server.
- **We picked** — The server does the sign-in handshake. Both tokens go out as `HttpOnly` cookies. The browser never holds a token.
- **What we get** — No script on our page can read a token, so a cross-site scripting bug cannot steal a session. There is also no token code in the front end at all.

### D-02 — `SameSite` plus an `Origin` check
- **Problem** — Browsers send cookies on their own. Another site can make the browser act as our user.
- **Options** — `SameSite` alone. `SameSite` plus an `Origin` check. Both plus a third cookie the front end echoes back. The `csurf` package.
- **We picked** — `SameSite` plus an `Origin` check on the server. No GET ever changes data.
- **What we get** — About ten lines of code, nothing to store, nothing for the front end to remember. Both checks run on the server, so the UI cannot get them wrong.

### D-03 — Cookie names and lifetimes come from config
- **Problem** — They were written into the code, and the lifetimes must match the identity provider.
- **Options** — Leave them in the code. Move them to environment variables.
- **We picked** — Environment variables (R-3f).
- **What we get** — One value can change per environment with no rebuild, and the cookie lifetime can be kept in step with Keycloak.

---

## Reading data

### D-04 — Board paging uses `page` and `pageSize`
- **Problem** — The SRS set page sizes but never named the query parameters, so the front end and the back end had nothing to agree on.
- **Options** — `page`/`pageSize`. `page`/`per_page`. `offset`/`limit`. A cursor. Keep the 100-row maximum, raise it, or drop it.
- **We picked** — `page` and `pageSize`, with no maximum. R-21, R-22 and R-96 were changed to match.
- **What we get** — Two names that say what they mean, one shared contract for both sides, and the freedom to read the whole board in one call when a script needs it.

### D-05 — Comments are flat, newest first, read with a cursor
- **Problem** — R-33 said flat, oldest first, paged. On an old request the newest comment is the one people need, and oldest-first buries it on the last page.
- **Options** — Oldest first with pages. Oldest first opened at the last page. Newest first with pages. Newest first with a cursor. Ranked by relevance.
- **We picked** — Newest first, read with a cursor (`cursor` and `limit`) built from `created_at` and `id`.
- **What we get** — The newest comment is the first thing read, with no paging. A new comment appears at the top with no reload. A cursor never shows a comment twice and never skips one, however many arrive while a person is reading.

### D-11 — Search runs at read time
- **Problem** — A `search_vector` column and a `last_activity_at` column cost a write on every change.
- **Options** — Keep the tsvector and its trigger. Keep one of the two. Drop both.
- **We picked** — Drop both. Search is a plain `ILIKE` over the title and the description, run when we read.
- **What we get** — Two fewer columns, no trigger to keep correct, and no write amplification on every edit. Search still works. A trigram index can be added later without changing any data.

---

## Where settings live

### D-06 — Theme, sort and filters live in the browser. Language lives on the server.
- **Problem** — The brief asks where configuration lives, and how the front end gets it without a chain of blocking calls at startup.
- **Options** — All on the server. All in the browser. Split them by who needs them.
- **We picked** — Theme, default sort and default filters in `localStorage`. Language on the server, with a copy in the browser.
- **What we get** — The server only stores what it actually uses. The first paint never waits for a network call, and the app still draws in the right language when `/bootstrap` is slow or fails.

### D-07 — Email preferences are two boolean columns
- **Problem** — Two notification choices needed a home.
- **Options** — A preferences table keyed by user and event type. Two `NOT NULL DEFAULT true` columns.
- **We picked** — Two columns.
- **What we get** — No join on every read, no missing-row case to handle, and a default that is true for everyone from the moment the account exists.

### D-09 — `app_settings` keeps one real feature flag
- **Problem** — The settings row carried defaults that nothing read.
- **Options** — Keep the global-default ladder. Drop the fields nothing reads.
- **We picked** — Drop `default_theme`, `default_language`, `default_sort`, `version`, `updated_by` and `features`. Add `feature_comments_enabled`, which blocks the screen **and** the server (R-42).
- **What we get** — One flag that visibly changes the app when an admin toggles it, which is exactly what the brief asks for, instead of a bag of settings nobody reads.

---

## Fields we removed

### D-08 — No status-history table
- **Problem** — We had invented a table recording every status change. The brief never asks for one; "history" there always means Git history.
- **Options** — Keep it. Keep only the last change. Drop it.
- **We picked** — Drop it. Eleven tables became ten.
- **What we get** — One less table and one less write on every triage action, and the data model now matches the brief instead of our guess.

### D-10 — No terminal-status flag
- **Problem** — `statuses.is_terminal` existed to drive a "hide closed" filter we never specified.
- **Options** — Keep the flag and build the filter. Drop both.
- **We picked** — Drop the flag. R-50 is deleted.
- **What we get** — No half-built filter, and admins configure statuses as plain names with no hidden meaning attached to any of them.

### D-12 — No `moderated_by` column
- **Problem** — Nothing reads who approved, rejected or deleted a comment.
- **Options** — Keep the column. Build a real audit log. Drop it.
- **We picked** — Drop it.
- **What we get** — One less write path on every moderation action, and no column pretending to be an audit trail. If an audit trail is needed, it gets built properly.

### D-13 — `invitations` keeps only what is read, and R-66 is filled
- **Problem** — `invited_by` and `accepted_user_id` were never read.
- **Options** — Keep them. Drop them.
- **We picked** — Drop both. Fill the empty R-66: only an admin may create, list or revoke an invitation, checked on the server.
- **What we get** — Two fewer foreign keys, and a numbered rule with a test behind it for something part 4 only said in passing.

### D-14 — Categories and statuses read in `created_at` order
- **Problem** — `sort_order` meant building a drag-to-reorder screen and an endpoint.
- **Options** — Keep the column and build reordering. Keep it unused. Drop it.
- **We picked** — Drop it. Seed data is created in pipeline order, so the statuses read New, Under Review, Planned, In Progress, Done, Declined.
- **What we get** — The lists come out in the right order with no UI, no endpoint and no tests to write for them.

---

## Rate limits

### D-15 — Three sliding windows, changeable while the app runs
- **Problem** — The brief asks for rate limits on submissions. Nothing stopped a loop of writes.
- **Options** — Constants in the code. Environment variables. Rows in `app_settings`. A fixed window or a sliding one.
- **We picked** — Six fields in `app_settings`: sign-ups 20 per hour for the whole app, new requests 10 per hour per person, votes 100 per hour per person. Sliding window. The refusal names the time to try again (R-131). The count and the write happen in one database step (R-132). Deleted requests still count inside the window.
- **What we get** — An admin can retune a limit without a deploy. A sliding window means no burst at the top of the hour. One database step means two calls in the same second cannot both slip through. Counting deleted requests closes the write-delete-write loop.

---

## Stack and architecture

### D-16 — Angular 20, standalone components, signals, Tailwind
- **Problem** — The brief names Angular and asks us to justify the version, the state management, the styling and the component approach.
- **Options** — Angular 17 or 20. State: NgRx, NGXS, a `BehaviorSubject` service, or signals. Styling: Angular Material, PrimeNG, CSS-in-JS, or Tailwind with our own components.
- **We picked** — Angular 20, no NgModules, lazy routing per feature. State in signals, one small store service per feature. Tailwind driven by a single design-token file.
- **What we get** — Far less boilerplate than an NgModule app, and the whole state layer in a few lines. One token file is what makes every screen look the same (H-9). Owning our components means we control their keyboard and contrast behaviour instead of arguing with a kit.

### D-17 — Node.js 22 with NestJS 11
- **Problem** — The brief prefers Node. The framework is still ours to choose.
- **Options** — Express. Fastify. NestJS. A non-Node runtime.
- **We picked** — NestJS 11, TypeScript in `strict` mode.
- **What we get** — One agreed shape for modules, dependency injection and the guard chain, which is what H-9 and R-150 ask for. Dependency injection is what makes the ports-and-adapters split in D-18 cheap. The OpenAPI document falls out of the decorators (R-78).

### D-18 — A modular monolith, not a set of services
- **Problem** — The brief prefers a service split but says plainly that a good argument for simplicity beats an unjustified one.
- **Options** — One folder with no seams. One deployable with enforced module seams. Three or four services. A service per entity.
- **We picked** — One deployable cut into eight modules — `identity`, `requests`, `votes`, `comments`, `taxonomy`, `settings`, `invitations`, `notifications` — plus a separate worker for email. Inside each module: `domain`, `application`, `infrastructure`, `http`, with dependencies pointing inward. CI enforces both the module seams and the layer rule (R-143).
- **What we get** — The rules that matter here are transactional and touch two tables at once: count-and-write (R-132), one vote per person (R-26), one default status (R-47). A single database transaction gives us all three for free. No network hop to debug a vote. And the seams are real, so `notifications` can be lifted out later — which is why it already runs as its own process.

### D-19 — PostgreSQL 16, Prisma 6, raw SQL for the board
- **Problem** — The database and the way we reach it from TypeScript are ours to choose and justify.
- **Options** — Postgres, MySQL, MongoDB, SQLite. Prisma, TypeORM, MikroORM, Drizzle, or plain SQL.
- **We picked** — Postgres 16. Prisma owns the schema and the migrations. Repository interfaces live in `application` and their Prisma implementations in `infrastructure`, so no Prisma type reaches the domain or an HTTP response (R-147). The board query is one typed raw SQL statement (R-148).
- **What we get** — Every "the database stops it" promise is a real constraint: a unique index on `(request_id, user_id)`, a partial unique index for the single default status, foreign keys that refuse to drop a category still in use. Prisma's migration tool makes R-82 a real step instead of a script someone remembers to run. The board's search, filters, sort, pinned-first, paging and both derived counts come back in one round trip.

### D-20 — Redis 7 for shared state
- **Problem** — R-118 forbids the API keeping state in its own memory between calls, but counters, idempotency keys and the bootstrap cache need a home every copy of the API can see.
- **Options** — Process memory. Postgres. Redis.
- **We picked** — Redis 7, holding only the rate-limit counters, the idempotency keys and a short-lived bootstrap cache (R-149). Postgres stays the source of truth.
- **What we get** — Two API copies behind a load balancer share one counter instead of each counting to ten. Expiring counters are exactly the shape Redis is good at, and that write load stays off the table Postgres is guarding. Losing Redis degrades but never corrupts — one person gets one extra try.

### D-21 — Keycloak, self-hosted in this repository
- **Problem** — The brief requires an open-source identity provider with email/password and at least one social login, and forbids writing auth primitives ourselves.
- **Options** — Keycloak. Ory. Authentik. Zitadel. A hosted service with a free tier.
- **We picked** — Keycloak, with a seed realm exported as one JSON file and imported at startup, carrying the test accounts and the first admin.
- **What we get** — Email/password and social login work out of the box. OIDC is standard, so R-3a to R-3c are ordinary rather than clever. The realm import is what makes the one-command start honest: the reviewer runs everything from this repository, with no account to create anywhere.

### D-22 — Test-driven development in four layers, with Playwright on top
- **Problem** — The brief sets no coverage target, but part 4 of the SRS says every "no" needs a test proving the server says no.
- **Options** — Write tests after the code and chase a coverage percentage. Write only end-to-end tests. Drive the work test-first in deliberate layers.
- **We picked** — Red, green, refactor, for every numbered rule (R-156). Unit tests for the domain and use cases with fake ports. Integration tests for repositories and database constraints, against real Postgres and Redis via Testcontainers. API tests through the whole guard chain with Supertest. Front-end tests through what a person sees, with Angular Testing Library. Playwright end-to-end on the full compose stack, signing in for real through Keycloak (R-159, R-160).
- **What we get** — The rule numbers are the test list, so the tests read as the specification. Testcontainers is the only thing that can prove "the database stops it" — a mocked repository would pass with the constraint missing. Real sign-in in the end-to-end suite keeps the one thing that suite exists to prove.
