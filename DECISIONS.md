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

---

## Building it

### D-23 — Testcontainers finds the container runtime by itself
- **Problem** — D-22 rests on Testcontainers, and Testcontainers assumes a Docker daemon. The machine this was built on runs podman emulating docker: its socket is not where Testcontainers probes, so every integration test failed at once with "Could not find a working container runtime strategy". Ryuk, the reaper Testcontainers starts to clean up, also cannot run from a rootless socket.
- **Options** — Write the two environment variables in the README and let each developer export them by hand. Commit them into an `.env.test` the test runner loads. Detect the runtime in a Jest setup file. Give up on Testcontainers and point the tests at a Postgres started by docker compose.
- **We picked** — Detect it. `test/support/container-runtime.ts` runs before the integration and API suites: if the developer has set `DOCKER_HOST` themselves it changes nothing, and otherwise, if a rootless podman socket exists, it points at that socket and turns Ryuk off. `npm run test:integration` works with no environment set up on either podman or real Docker.
- **What we get** — The tests run from a fresh clone with nothing to remember, which is the same promise R-80 makes for the app. The cost is real: turning Ryuk off means a crashed test run can leave containers behind, so containers are stopped explicitly in `afterAll` and a hard kill during a run needs a manual `podman rm`. The detection is also a guess about the machine — it reads a socket path built from the user id, and on an unusual setup it will guess wrong, though only ever when `DOCKER_HOST` was not already set. We did not drop Testcontainers, because a compose-managed database would make "the database stops it" depend on a service the test did not start.

### D-24 — The same rule is checked twice: in the DTO and in the database
- **Problem** — SRS part 14 says who stops each promise, and for several of them the answer is "Database". But the same rules also have to produce a helpful message under the right field (R-88), and a foreign-key error is not that message. So where does a rule like "a title is 5 to 120 letters" actually live?
- **Options** — Check it only in the DTO, and trust the code to run first. Check it only in the database, and translate the failure into a field message. Check it in both places.
- **We picked** — Both, with different jobs. The DTO check exists to give a good message and a 400; the database CHECK exists so the rule holds when two things happen in the same second, when a migration backfills, or when someone opens `psql`. The integration tests assert the *database* refuses, with the use case bypassed entirely, so a missing constraint fails the build even though the DTO would have caught it in normal use.
- **What we get** — The promise is as strong as the SRS says it is, and the error a person sees is still the useful one. The cost is duplication: the numbers 5 and 120 appear in a DTO and in a migration, and a change has to touch both — with a migration needed for the second. We accepted that because the alternative is a rule that only holds while the happy path is taken, which is exactly the failure R-115 was written to prevent. Where a rule needs *other rows* to check — "is this the last active category?" — there is no constraint to write, and the use case is the only guard; those are the cases where the SRS says "Server" rather than "Database".

### D-25 — The guard chain is composed at the root, not in the shared kernel
- **Problem** — The guard chain of R-138 is shared, so it looked like it belonged in the shared kernel with the error shape and the config. But its first link has to answer "who is signed in", and that answer comes from the `identity` module. The shared kernel may never depend on a module (R-141), so the obvious placement was actually a seam violation, and Nest refused to resolve it.
- **Options** — Let the shared kernel import `identity` and drop the seam. Put the whole guard chain inside `identity`. Keep the guard classes in the shared kernel and register them in `AppModule`, which is allowed to know about both.
- **We picked** — The third. `shared/http/` holds the guard classes and the `CurrentUserSource` port; `AppModule` binds the port to an implementation and registers the three guards in order.
- **What we get** — The seam survives, and the order of R-138 is still declared in exactly one place. The cost is that the composition root now carries wiring a reader might expect to find next to the guards, so both files carry a comment pointing at the other. While `identity` is unbuilt the port is bound to a placeholder that returns "nobody is signed in", which means every guarded route answers 401 — chosen deliberately, because an unfinished app that refuses everything is honest, where one that lets everything through is a hole.

### D-26 — The Keycloak realm pins the user ids the seed data expects
- **Problem** — Two systems hold the same three test people. Keycloak owns the account you sign in with; our `users` table owns the request they wrote and the vote they cast. They are tied together by `users.external_id`, which holds the Keycloak user id. On a fresh start Keycloak invents that id, so the seeded rows point at nobody: the reviewer signs in as `sam@feedbackhub.local` and sees an empty board, with a second Sam created beside the first.
- **Options** — Let the seed run after Keycloak and read the ids back over the admin API. Have the seed only create categories and statuses, and let the reviewer write the first request by hand. Match on email instead of id. Pin the ids in the realm export and use the same three constants in the seed.
- **We picked** — Pin them. `infra/keycloak/realm/feedbackhub-realm.json` gives each test account a fixed uuid (`1111…`, `2222…`, `3333…`), and `prisma/seed/seed.ts` writes those same values into `external_id`.
- **What we get** — The migration step of R-82 stays what it is: one job against Postgres, finished before the API starts, with no dependency on Keycloak being up and no admin credentials in the migration image. Signing in as a seeded account lands on the seeded person, so SRS part 15 is reachable on the first run. The cost is a hidden coupling — the same three uuids live in two files, and nothing fails loudly if one is changed alone; the symptom is an empty board, not an error. `infra/keycloak/realm/README.md` sits beside the export saying so. Matching on email was rejected because it would make an email change silently create a second account, and reading the ids back would have made the migration job wait on Keycloak.

### D-27 — The realm export carries no comments, so its notes live beside it
- **Problem** — The realm JSON encodes choices a reader needs explained: why the client is confidential, why PKCE is on, why the token lifetimes are what they are. The natural place is a comment in the file. JSON has none, so the usual trick is a `_comment` key.
- **Options** — `_comment` keys in the JSON. No explanation at all. A README beside the file.
- **We picked** — A README beside it. Keycloak 26 validates the import strictly and rejects any field it does not recognise, so a `_comment` key does not get ignored — it kills the import and the container exits 1, with the realm and all three test accounts missing. This was not theory: it happened on the first real run of the stack, and the only visible symptom downstream was that signing in did not work.
- **What we get** — The import is the thing the one-command start depends on, and it now cannot be broken by adding a note. The cost is that the explanation is one file away from what it explains, so a change to the lifetimes has two files to touch and nothing enforces the second.

### D-28 — Keycloak has two addresses, and the code asks it which to use
- **Problem** — Running the stack, sign-in died at the first redirect. The API reaches Keycloak at the container name `keycloak:8080`; a browser on the developer's machine can only reach it at `localhost:8080`. The code built the sign-in URL by joining the issuer it dials with `/protocol/openid-connect/auth`, so it sent the person to `http://keycloak:8080/…` — a host that does not exist outside the container network. Nothing appeared in any log, because from the server's point of view every step had succeeded.
- **Options** — Point the API at `localhost:8080` too (it cannot: inside a container that is the container itself). Ask the reviewer to add a line to `/etc/hosts` (then it is no longer one command, R-80). Add a second environment variable for the browser-facing address, and keep building the URL by hand. Configure Keycloak to publish both addresses, and take the URL from its discovery document.
- **We picked** — The last one. `KC_HOSTNAME=http://localhost:8080` makes the browser-facing address and the `iss` claim the public one; `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true` lets server-to-server calls answer on whatever name they arrived at. The discovery document then carries a `localhost` authorization endpoint and a `keycloak` token endpoint at the same time, and `startSignIn()` reads the URL from it instead of assembling one.
- **What we get** — One setting to be wrong instead of two that must agree, and the token's issuer matches what the library verifies against, so R-5 is unaffected. Sign-in works from a browser with nothing for the reviewer to configure. The costs are real: `startSignIn()` had to become asynchronous, because discovery is a network call, which changed the port, the controller and the test double; and the app now cannot build a sign-in URL at all when Keycloak is unreachable, where before it produced one that merely did not work. We prefer the honest failure — the readiness probe already reports the provider separately (R-83). A fourth option, a second environment variable, was rejected because two addresses that must be kept in step is exactly the kind of drift D-26 is already paying for elsewhere.

### D-29 — A `.env` file is read at start-up, and never wins over the real environment
- **Problem** — Nothing loaded a `.env` file. The app read `process.env` and nothing else, which is right for a container but means running the API from source needed roughly twenty `export` lines typed by hand, or a wrapper script. The failure was also confusing rather than loud: `prisma migrate deploy` worked, because the Prisma **CLI** reads `.env` by itself, and then the seed script failed with "Environment variable not found: DATABASE_URL" — the Prisma *client* does not.
- **Options** — Leave it, and document the exports. A shell script that sources a file before starting. `@nestjs/config`'s `ConfigModule.forRoot({ envFilePath })`. One `import 'dotenv/config'` at the top of each entry point.
- **We picked** — The last. `main.ts`, `worker.ts` and `prisma/seed/seed.ts` each load it as their first import; `dotenv` is now a declared dependency rather than one inherited from `@nestjs/config`.
- **What we get** — Running from source needs one file, and it is the same file the Prisma CLI already used, so there is one list of values instead of two. `dotenv` never overwrites a variable that is already set, so a container — which sets its own and ships no `.env` — behaves exactly as before, and the Zod check at boot is untouched: a missing value still stops the boot with every problem listed (R-102). `ConfigModule` was rejected because the app deliberately validates its environment with Zod in one place, and adding a second configuration system would be two ways to do one thing (R-150). The cost is that a stale `.env` is now a way to be confused — a value you thought you had changed in your shell is beaten by the file only if the shell variable is unset, and the file is invisible in `git status` because it is ignored. That is the usual bargain, and `.env.example` stays the committed list of what exists.

### D-30 — The API's CSP names `connect-src`, because it does serve one page

- **Problem** — `helmet` was configured with `defaultSrc: ["'none'"]` and a comment saying the API serves JSON and never a page. That stopped being true when R-78 put Swagger UI on `/api/docs`. Helmet ships no `connect-src` of its own, so `connect-src` inherited `default-src` and became `'none'`. The page itself loaded perfectly — `script-src` and `style-src` are named explicitly in helmet's defaults — so the docs looked fine until you pressed Execute, and every call died as "Failed to fetch". Swagger's own message blames CORS first, which is wrong here: the docs page and the API are the same origin, so CORS never enters it.
- **Options** — Drop the CSP on the whole API. Leave the global CSP alone and mount a second, looser one on the `/api/docs` route only. Serve the docs from somewhere else entirely. Add `connectSrc: ["'self'"]` to the one CSP.
- **We picked** — The last. One directive, added to the existing block.
- **What we get** — The docs work, and the loosening is exactly as wide as the problem: same-origin calls, nothing cross-origin, everything else still `'none'`. A CSP on a JSON response is inert anyway — it constrains a document, and there is no document — so the API surface gives up nothing real. The cost is that one CSP now serves two purposes, and the next thing added to `/api/docs` may need another directive with no test to catch it; nothing pins these headers today. The per-route override was rejected because it means two CSPs to keep in step, which is the drift D-26 is already paying for.

### D-31 — Healthchecks are written in `CMD-SHELL` form, not `CMD`

- **Problem** — The API container never once reported healthy. Its healthcheck was `test: ['CMD', 'node', '-e', "fetch(…)…"]`, which is correct Docker: the exec form runs the command directly, with no shell to confuse. `podman-compose` 1.0.6 does not implement it that way — it flattens the list into a single string and hands it to `/bin/sh -c`, which turned the command into `node' '-e' '…'` and produced `/bin/sh: syntax error: unexpected "("`. The Redis check next to it survived the same treatment, because `redis-cli ping` has no characters a shell cares about, which is what made the bug look specific to the API.
- **Options** — Require Docker and document podman as unsupported. Move the check into the image with a `HEALTHCHECK` line in the Dockerfile. Rewrite the probe with no shell metacharacters. Write the check in `CMD-SHELL` form with the quoting done once.
- **We picked** — `CMD-SHELL`. The Keycloak check three services above already used it, for the same reason.
- **What we get** — One form that behaves the same under Docker and podman, and the failure it was hiding is gone: `depends_on: service_healthy` on a container that can never turn healthy blocks anything waiting on it, so this was a start-up bug wearing a monitoring bug's clothes. The cost is that the command now goes through a shell it does not need, so its quoting matters and a stray quote is a runtime error rather than a parse error. A `HEALTHCHECK` in the Dockerfile was rejected because it moves the value out of the file where every other service's check is written.

### D-32 — The refresh cookie is scoped to `/v1/auth`, not to the refresh route alone

- **Problem** — The refresh cookie was written with `Path=/auth/refresh`, taken from `AUTH_COOKIE_REFRESH_PATH`. The app sets a global `v1` prefix, so the real route is `/v1/auth/refresh`. A browser matches `Path` against the whole URL path, so the cookie was sent to **nothing**: `POST /v1/auth/refresh` always answered 401, and `POST /v1/auth/sign-out` read `undefined` for the refresh token, skipped `endSession()`, and cleared our cookies while leaving the Keycloak session alive — so the next sign-in came back with no password asked. Nothing failed loudly. Sign-out returned 204 and looked correct.
- **Options** — Set the path to `/v1/auth/refresh` and leave sign-out unable to end the provider session. Set it to `/v1/auth/refresh` and have sign-out end the session with the access token instead. Drop the path scoping and use `Path=/` like the access cookie. Scope it to `/v1/auth`, which covers both routes that need it.
- **We picked** — The last. The default is now `/v1/auth`.
- **What we get** — Both routes that need the token receive it, R-9 works for the first time, and the scoping R-3e asks for is kept: the cookie still never reaches the board, the comments or anything else in the app, and it is still `SameSite=Strict`. The cost is that it is now sent to two more routes that do not need it, `/v1/auth/sign-in` and `/v1/auth/callback`, which is a real if small widening. Ending the session with the access token was rejected because `endSession()` revokes a refresh token, and rewriting it would have changed the provider port to fix a cookie bug. `Path=/` was rejected outright: that is the scoping R-3e exists to prevent. The prefix is now part of the value, which means this variable must change if the prefix ever does — the same drift D-26 warns about, accepted here because the alternative is building the path from the prefix at runtime and hiding the coupling instead of writing it down.

### D-33 — Keycloak sends its mail through Mailpit, set in the realm file

- **Problem** — "Forgot password?" ended on *"Failed to send email, please try again later."* `resetPasswordAllowed: true` only shows the link; Keycloak still needs a mail server, and `smtpServer` was absent from the realm import. Password reset had never worked.
- **Options** — Leave it, and document reset as unsupported. Tell the reviewer to fill in the Email tab in the admin console by hand (then it is no longer one command, R-80). Point Keycloak at a real SMTP server. Point it at the Mailpit container the compose file already runs.
- **We picked** — Mailpit, written into `feedbackhub-realm.json` as `host: mailpit, port: 1025`, no TLS and no auth.
- **What we get** — Reset works from a fresh clone with nothing to configure, and the mail is readable at `http://localhost:8025` next to the mail our own worker sends, so both are seen in one place. Nothing leaves the machine. The costs: the realm file now hard-codes a hostname that only exists inside the compose network, so a deployment that is not this compose file must override it; and the settings are the insecure ones, which are correct for a catcher and wrong for anything else. A real SMTP server was rejected because it needs credentials that cannot be committed (R-102).

### D-34 — Google is defined in the realm, disabled, and trusts the email it sends

- **Problem** — R-2 asks for at least one social sign-in. Only GitHub was defined, and its credentials cannot be committed, so in practice the repository shipped no social provider anyone could switch on quickly. Google is the one most reviewers already have an account with.
- **Options** — Leave GitHub as the only one. Add Google and commit real credentials (forbidden by R-102). Add Google and read the id and secret from environment variables. Add Google disabled, with placeholder credentials, exactly as GitHub already is.
- **We picked** — The last, so the two providers are configured the same way and there is one pattern to learn.
- **What we get** — Turning Google on is three fields in the admin console and no file to edit, and the realm file documents that the option exists rather than leaving the next person to discover it. `trustEmail` is `true` for Google and stays `false` for GitHub: Google verifies the address it hands over and GitHub may not, and the `domain_restricted` rule (R-67) refuses an unverified address even on an allowed domain — so the difference decides whether a social sign-in is let in at all. The costs: a disabled provider is dead configuration that no test covers and nobody has ever switched on, so it may be subtly wrong and we would not know; and `trustEmail` is a statement about a third party we cannot verify — if Google ever hands over an unverified address, R-67 is bypassed for that person. Environment variables were rejected because the realm import is a JSON file read once at first start, and adding a substitution step to it buys nothing when the admin console already edits the same setting live.

### D-35 — The `iss` on the callback is passed through, not dropped

- **Problem** — Every sign-in failed, with a password and through Google alike, and always the same way: the browser came back to `/v1/auth/callback` and was redirected to `/sign-in-problem?problem=sign_in_failed`. The API log said `RPError: iss missing from the response`. Keycloak 26 advertises `authorization_response_iss_parameter_supported: true` in its discovery document and puts `iss` on the callback (RFC 9207, which exists so a client with several providers cannot be tricked into sending a code to the wrong one). `openid-client` therefore *requires* that parameter. Our controller read `code` and `state` out of the query and built a fresh object from them, so `iss` was thrown away one line before the library looked for it. Nothing in the tests could see this: they replace the provider with a stub, so the only code that ever received an `iss` was the code that never ran.
- **Options** — Turn the check off in `openid-client`. Hand the raw Express request to the adapter and let it call `client.callbackParams()`. Rebuild the parameters in the adapter from a wider input. Add `iss` to the port's input and pass it through untouched.
- **We picked** — The last. `completeSignIn` takes an optional `receivedIssuer`, the controller fills it from `@Query('iss')`, and the adapter puts it back on the parameter object only when it is present.
- **What we get** — The check RFC 9207 asks for actually runs, and it runs where it belongs: the library compares `iss` against the issuer it discovered, so we are not writing an auth primitive of our own (R-1). The parameter is optional, so a provider that sends none still works. The costs: the port grew a field that is plainly OIDC vocabulary leaking through an interface meant to be provider-neutral, and a caller that forgets it gets a failure that says nothing about the caller. Handing over the raw request was rejected because it would put Express inside the port and let the adapter read anything it liked; turning the check off was rejected outright — it is a real protection, and it was the only thing that noticed we were wrong.

## The front end

### D-36 — Angular 22, and what that costs

- **Problem** — SRS §8.1 named Angular 20. The brief asks us to justify the version. Angular 22 shipped in June 2026 and is the current stable line.
- **Options** — Stay on 20 as written. Take 21. Take 22.
- **We picked** — 22, and this entry supersedes the SRS's 20 rather than pretending the SRS said it.
- **What we get** — Three things become free that we would otherwise have built by hand. `OnPush` is the default strategy in 22, so no component has to declare it and none can forget. Zoneless is the default, so there is no Zone.js to reason about. Signal Forms are stable, which matters more than it sounds: form rules live in a schema rather than a template, so every validator is unit-testable without rendering a component — exactly the TDD the assignment asks for. `httpResource` and `rxResource` are also stable, giving loading and error as signals for read paths. The costs, and they are real: 22 requires TypeScript 6.0.x and Node ^22.22.3, which is stricter than what this machine had (see the README); the ecosystem is younger, and `openapi-typescript` still declares a TypeScript `^5.x` peer, so it is run through `npx` with its own TypeScript rather than installed into the app; and the version is three months old, so there are fewer answers to search for when something breaks. Angular 21 was the safe pick and would have run on the machine as it stood, but its Signal Forms are experimental, and building every form in the app on an experimental API to avoid a Node patch upgrade is the worse trade.

### D-37 — A client-rendered SPA, not server-side rendering

- **Problem** — SSR is the default assumption for a new Angular app in 2026, and the tooling makes it a one-flag decision. It deserved to be decided, not defaulted.
- **Options** — SSR for everything. Hybrid: SSR some routes, CSR the rest. Prerender at build time. Client-rendered only.
- **We picked** — Client-rendered only, served as static files behind nginx, which proxies `/v1` to the API so the browser sees one origin (R-3h).
- **What we get** — SSR earns its cost when an anonymous visitor arrives cold from a search engine. This app has no anonymous route at all: the first thing anyone meets is a redirect to Keycloak, so there is no cold first paint to improve and no crawler to serve. Against that, three costs land squarely on us. `HttpOnly` cookies are not attached to `HttpClient` calls made on the server, and this app's browser holds nothing *but* `HttpOnly` cookies — so SSR would mean hand-writing credential forwarding for every request in the app, which is the one path we least want to hand-roll. Angular's server-rendering packages have carried four separate SSRF advisories, and the impact named in CVE-2026-27739 is session-cookie exfiltration; that class of bug exists only if SSR is running, and our whole auth model is session cookies. And SSR would make the theme flash worse, not better: the server cannot read `localStorage`, so it would render light and the browser would repaint dark, a flash that the client-only inline script does not have. The cost of choosing CSR is a slower first paint on a cold cache and no SEO — neither of which this product needs. If FeedbackHub were ever made public, this decision should be revisited, and hybrid rendering would be the shape to reach for.

### D-38 — Signals and small stores, not NgRx

- **Problem** — The app needs somewhere to keep the bootstrap snapshot, a board page, a comment cursor, and per-device preferences.
- **Options** — NgRx Store. `@ngrx/signals` SignalStore. Plain signals in one store service per feature.
- **We picked** — Plain signals, one store service per feature, provided on the route so it dies with the route.
- **What we get** — Most of what a state library would manage is not in a store at all: the board's search, filters, sort and page live in the URL, because R-22 requires a board view to be shareable and reachable with the back button. The store derives from the route rather than owning it. What is left is four small objects, and R-134 already prescribes this shape. The costs: no time-travel debugging, and the discipline that a library enforces structurally — one way to mutate, one way to select — is enforced here by review and by an ESLint boundary rule instead. If a cross-feature cache ever appears, `@ngrx/signals` is the migration and it is incremental.

### D-39 — Contract types are generated; the transport is ours

- **Problem** — The front end must not hand-copy the API's shapes into interfaces that silently rot.
- **Options** — `ng-openapi-gen` (full Angular client). `ng-openapi` (Angular-first, `httpResource`-aware). `@hey-api/openapi-ts` with its Angular client. `orval`. `openapi-typescript` for types plus a small typed wrapper over `HttpClient`.
- **We picked** — The last: `openapi-typescript` generates `schema.d.ts` from the live `/api/docs-json`, and a small `ApiClient` typed from it sits on `HttpClient`, with a thin gateway per feature.
- **What we get** — Every request keeps passing through Angular's interceptors, which is not negotiable here: the silent `401 → refresh → replay` path is the whole session model, and a client that bypasses `HttpClient` would bypass it. Drift protection is the same as any generated client — CI regenerates and fails on a diff. And the layer count is two rather than three, because we would still need gateways for signals and optimistic vote rollback on top of any generated service. The costs: roughly eighty lines of generic TypeScript that are ours to maintain and get wrong, covered by type-level tests; and `openapi-typescript` peers on TypeScript `^5.x` while Angular 22 wants `6.0.x`, so it runs via `npx` rather than as an installed dependency. The two Angular-native generators were rejected on maintenance, not on design: `ng-openapi-gen` last published in November 2025 and predates both Angular 21 and 22, and `ng-openapi` is at v0.3.2. Hey API's Angular client does wrap `HttpClient`, but its interceptor documentation is still marked under construction and the package is pre-1.0, which is not where the auth path should sit. At forty-three endpoints the hand-written wrapper is the smaller thing; at four hundred a full generator would win, and the migration is mechanical.

### D-40 — The app is colour-quiet because the colours are data

- **Problem** — Category and status colours are rows in the database that an admin edits at runtime (R-43, R-44). We cannot know them at design time, and we cannot know their contrast.
- **Options** — Use the admin's hex as a chip background with black or white text picked by a luminance calculation. Ignore the hex and use a fixed palette. Use the hex only as a small solid mark, with neutral text on a low-alpha wash of it.
- **We picked** — The last, and the app's own palette is kept deliberately quiet around it: warm neutrals, one blue that means "you can act on this", and semantic colour used only for state.
- **What we get** — Chip contrast is ours in both themes whatever the admin types, because the text is a neutral we control and never sits on an unknown colour. Every chip also writes its name next to the dot, so colour is never the only signal (R-111). And because the chrome is neutral, an admin's magenta category does not fight the interface on every row of the board. The costs: the admin's chosen colour is less prominent than they might expect — it is a dot and a wash, not a filled badge — and the wash needs a different alpha per theme, which is one more token to keep honest. Picking text colour by luminance was rejected because it is a coin-flip at mid-tones and produces chips that are technically passing and genuinely hard to read; every value in the palette was instead measured against its own background in both themes, which caught two failures that looked fine by eye.

### D-41 — IBM Plex Sans and IBM Plex Sans Arabic

- **Problem** — R-57 requires the language to switch at runtime between English and Arabic, so both scripts appear in the same product and often on the same screen.
- **Options** — A Latin font with an unrelated Arabic fallback. Two separately chosen families. One superfamily covering both scripts. The system stack.
- **We picked** — IBM Plex Sans with IBM Plex Sans Arabic, both on Google Fonts, with IBM Plex Mono for digits that must not shift.
- **What we get** — One superfamily drawn by one team means the same weights, proportions and rhythm in both scripts, so switching language changes the words and not the feel of the product. The costs: two font families to load rather than one, and Plex is a common choice, so the result reads as competent rather than distinctive. The design-system tool suggested Fira Code for headings; that was rejected — monospace headings make a feedback board read as a developer tool, and most of the people writing on this board are not developers. Fira also has no Arabic.
