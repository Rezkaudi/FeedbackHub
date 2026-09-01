# FeedbackHub

An internal product feedback board.

Employees post feature requests and feedback. Everyone can read them, upvote
them, and comment. An admin sets the status, curates categories, moderates
comments, and configures the app.

The goal: stop the same idea arriving five times by email, and make it visible
what is actually being worked on.

> **Status: the backend and the front end are built, and the eleven journeys
> from the brief run end to end.** `npm run verify` passes 297 backend tests
> against a real PostgreSQL and a real Redis; the front end has 240. The front
> end's whole presentation layer was rebuilt on Material Design 3 (blue) with
> full English and Arabic text and RTL, right after this line was written — the
> Cypress suite below is the *old* UI's suite and has **not** been re-run or
> updated against the new one yet, so it is not proof of anything until it is.
> What is still *not* proven is real outgoing mail. The two lists below say
> exactly which is which.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Front end | Angular 22, standalone components, signals, Tailwind, Material Design 3 tokens | D-16, D-36 |
| Back end | Node.js 22, NestJS 11, TypeScript strict | D-17 |
| Architecture | Modular monolith, 9 modules, + 1 email worker | D-18 |
| Database | PostgreSQL 16, Prisma 6 (raw SQL for the board query) | D-19 |
| Shared state | Redis 7 | D-20 |
| Sign-in | Keycloak, self-hosted | D-21 |
| Mail | SMTP + local mail catcher | D-21 |
| Tests | Jest, Testcontainers, Supertest, ATL, Cypress | D-22, D-48 |
| Packaging | Docker, Docker Compose, Kubernetes manifests | D-18 |

## What works

Everything in this section is covered by a test that runs today, unless the
line says otherwise.

**The shared parts**

- **Configuration from the environment.** Checked at boot, and the app refuses
  to start if something is missing or wrong. `AUTH_ALLOWED_ORIGINS` has no
  default: empty or `*` stops the boot rather than quietly allowing everything.
  Every problem is reported at once, not one at a time.
- **One error shape everywhere.** A machine code, an English message, the field
  names when a form is wrong, and a request id the person can quote. An
  unexpected error becomes a plain 500 that carries no stack, no database text
  and no library name. The status is always kept, so a readiness probe can
  answer 503 and mean it.
- **A request id on every call**, echoed in every error and in every log line.
  An id supplied by the caller is only kept if it is a plain uuid, so nothing can
  be smuggled into a log. Cookies, tokens and email addresses are redacted.
- **The guard chain**: signed in (401) → Origin check on writes (403) → admin
  role (403). Registered in one place, applied to every route.
- **Validation at the boundary.** Unknown fields are refused, not ignored, so a
  body carrying `id`, `authorId` or `status` is rejected rather than silently
  dropped.
- **Swagger at `/api/docs`**, generated from the same decorators the routes use.
- **Health checks.** `/health/live` never touches a dependency;
  `/health/ready` reports the database, Redis and the identity provider, and
  answers 503 when one of them is down.
- **The architecture rules are enforced, not requested.** A module that reaches
  into another module's internals, or a domain file that imports Prisma or Nest,
  fails `npm run depcruise`. Both failures were confirmed by deliberately
  writing the violation and watching the build go red.

**The database**

All nine tables from the SRS, with the invariants as real constraints — proved
against a real PostgreSQL 16, not mocks:

- ten simultaneous votes from one person leave exactly one row;
- a second default status is impossible;
- two categories cannot share a name, even in different capitals;
- a category or status in use cannot be deleted, only retired;
- a deleted comment is removed completely — row and all (this overrides the
  original R-38 "grey line"; see `DECISIONS.md`);
- a rate limit of `0` is refused, since it would mean nobody can write.

**Rate limiting**

A sliding window that counts the real rows, refuses inside the same database
step as the write, and names the time to try again — one window after the
person's *oldest* attempt, not one window from now. Proved against a real
Postgres: ten sign-ups fired at the same instant with a limit of three leave
exactly three rows. Not reset on the hour. It is wired to sign-up, to new
requests and to votes, and an admin changes the numbers with no restart.

One part of R-131 is **not** built: a deleted request stops counting towards the
limit. See [SCOPE.md](SCOPE.md) §8 for why.

**The modules**

- **`taxonomy`** — categories and statuses as data. Add, rename, recolour,
  retire, delete, move the "first status" mark. Admin only, refused by the
  server and not merely hidden. The last active category and the default status
  cannot be retired.
- **`settings`** — the app settings an admin changes with no restart (the
  sign-up rule, the approval switch, the comments feature switch, the six
  rate-limit numbers), and the settings a person owns. A person changing a
  theme, a sort or an admin setting through the user API is refused with a
  message, never quietly ignored. A change with one bad field leaves every
  setting as it was.
- **`identity`** — the Keycloak handshake on the server: code + PKCE,
  confidential client, tokens only in HttpOnly cookies, never in a response
  body. Token signature, issuer, audience and expiry checked on every call, read
  from the cookie and never from a header. Admin-ness re-read from the saved row
  before every admin action. Profile edit and account deletion, which wipes name,
  picture, email and votes, keeps requests and comments as "Deleted user", and
  refuses for the last admin. The tests drive this through a stub provider — see
  "what does not work" for what that leaves unproven.
- **`requests`** — create, read, edit, delete, plus admin status change and
  pinning. Status, author and timestamps are set by the server. The board is
  **one SQL statement**: search over title and description, status and category
  filters (or inside, and between), four sorts from a fixed list, pinned first
  within the chosen filter, paging, and both derived counts — no N+1, one round
  trip whatever the page size. `?sort=; DROP TABLE users` is refused as a bad
  value, and every other value is a bound parameter.
- **`votes`** — idempotent. Voting twice or un-voting nothing returns the
  current state instead of an error. Ten concurrent votes from one person leave
  exactly one row.
- **`comments`** — flat, newest first, cursor paging that does not skip or
  repeat when something arrives mid-page. The total is computed per viewer: a
  comment waiting for approval counts only for its author and for admins.
  Deleting leaves a tombstone with the body gone for good. An admin can delete
  someone else's comment but never edit it. With the comments switch off, the
  server refuses reads, writes, edits and deletes — for admins too.
- **`invitations`** — admin only, and refused by the server: a normal person
  calling the endpoint by hand gets 403 and no row is written. An address is
  stored in one shape, so capitals cannot make a second invitation.
- **`notifications`** — three events and no more. Nobody is emailed about their
  own action, the person's own switch is respected per event, and an invitation
  needs no preference because there is no account yet. A job carries ids only —
  no address sits in the queue. The recipient is looked up at send time, so an
  account deleted meanwhile is sent nothing. A failed send is logged without the
  address and dropped: **there is no retry**. Losing Redis loses queued emails
  and nothing else — proved against a real Redis, including that a job which
  cannot be read is dropped rather than blocking the queue behind it.
- **`bootstrap`** — one start-up call returning who I am, my settings, the
  switches, the categories and the statuses, composed from the other modules'
  published services.

**Packaging**

- Multi-stage Dockerfiles for the API and for the migration step. The API image
  runs as a non-root user — checked by running the built image.
- Migration and seed are their own image and their own step. Run twice against a
  real Postgres, it left identical row counts, so the seed is re-runnable.
- `docker-compose.yml` starts Postgres, Redis, Keycloak, Mailpit, the migration
  step, the API and the email worker, with the API gated on the migration
  finishing.
- Kubernetes manifests under `infra/k8s/`, with the migration as a Job the API
  Deployment waits for.
- CI runs lint, the dependency rules, the type check, all three test layers, a
  secret scan, and both image builds.

### The front end — the shell

- **The app boots with one call.** `GET /v1/bootstrap` and nothing else before
  the app appears (R-52, H-4). A test asserts no other request is made.
- **All three start-up outcomes are handled.** Ready shows the app; a failure
  shows what happened with a Try again button and the request id to quote; 401
  is treated as signed out, not as an error, and sends the person to Keycloak
  remembering the page they wanted. Try again now reloads the page once the
  start-up call succeeds — recovering the store alone left the router's
  cancelled first navigation stuck, so the error cleared to a blank page (D-49).
- **The session renews itself.** A 401 mid-use triggers one call to
  `/v1/auth/refresh` and the original request goes again. Requests that fail
  together share one renewal, because the provider rotates the refresh token and
  three parallel renewals would end the session they were trying to save.
  `11-errors-and-resilience` proves the one-attempt, no-loop behaviour; a real
  token expiry is still only in the "not proven" list below.
- **Theme works with no flash.** Read from `localStorage` before the first paint
  by an inline script, and light/dark/system all apply (R-55, R-56).
- **Sign-in failures are told apart.** "You may not join" and "you were unlucky
  with the timing" are different pages, because the second person *is* allowed.
- Skip link, visible focus, lazy routes, and a design-token file whose every
  colour pair was measured against WCAG AA in both themes.
- **The whole presentation layer was rebuilt on Material Design 3.** One blue
  seed (`#0B57D0`), full light/dark tonal palettes, the M3 shape, elevation,
  motion and state-layer scales, all as design tokens — a hand-tuned tonal
  scale built to the M3 structure, not the exact output of Google's own Theme
  Builder (see [DECISIONS.md](DECISIONS.md)). Every screen is now assembled
  from a shared component kit (button, icon-button, spinner, menu, dialog,
  chip, field, switch, avatar, pagination, snackbar) under `shared/ui/`, and
  every component is three files — `.ts`, `.html`, `.css` — never an inline
  template. No code comments anywhere in this layer, by request.
- **A user menu in the header**, opened from the avatar and name, closes on
  Escape, on a click outside it, and on every route change, and returns focus
  to the trigger when it does. It carries My settings, Admin (when the viewer
  is one), a language switch, a theme switch, and Sign out, separated and in
  red. The theme and language switches are their own small menus off the same
  component, and language is instant — no reload.
- **English and Arabic, with real right-to-left layout.** Every string in the
  app comes from two typed dictionaries (`core/i18n/translations/{en,ar}.ts`);
  Arabic is typed against English's exact key shape, so a missing Arabic string
  fails the build, and a test (`dictionaries.spec.ts`) checks the same thing
  at run time plus that neither dictionary has an empty string anywhere.
  Switching language flips `<html lang>` and `<html dir>`, is remembered for
  the next load, and the layout uses logical CSS properties throughout so RTL
  is a real mirror, not a patch. **This is unit-tested and has never been
  looked at in a real browser** — see "what does not work" below.
- **Every button that can be slow shows it.** A shared `fh-button` /
  `fh-icon-button` takes a `loading` input: the icon becomes a spinner, the
  label's width holds still, `aria-busy` is set, and a second click while it is
  busy is blocked at the DOM level (`disabled`), not just by a flag in a
  handler.
- **Deleting, retiring, approving, rejecting and withdrawing all ask first.**
  One `ConfirmService` and one `fh-confirm-dialog`, mounted once in the shell,
  used everywhere something cannot be undone: delete a request, delete a
  comment, retire or delete a category or status, approve or reject a waiting
  comment, withdraw an invitation, delete an account. The destructive ones are
  red; none of them default focus to the destructive button.

## What does not work

Nothing in this list is hidden.

- **No email has ever been seen to arrive.** The queue, the worker, the wording
  and the drop-on-failure rule are all tested, but nothing has been watched
  landing in Mailpit, and no real SMTP server has been contacted. The last hop is
  unproven.
- ~~**No sign-in has ever completed.**~~ It does now, and it is proven on every
  run. The end-to-end suite signs in through the real Keycloak login form with a
  seeded account (R-160), lands on the board, and then checks the parts that
  only a real sign-in can show: no token anywhere a script can read, the two
  cookies by name with their flags and paths, and exactly one call to
  `/bootstrap` afterwards. The cause of the old failure was D-35.
- **The four `/v1/auth/*` routes still have no *API* test of their own.** Every
  API test replaces the identity provider with a stub. That is how D-32 went
  unnoticed — the refresh cookie was scoped to a path that did not exist, so
  refresh and sign-out were both broken while every test passed. Sign-in and
  sign-out are now covered end to end in a real browser; **refresh is only
  covered indirectly** — `11-errors-and-resilience` proves a 401 triggers exactly
  one refresh attempt and does not loop, but no test watches a real expired
  access cookie be renewed, because it outlives a nine-minute run.
- **No social sign-in has been seen to work.** Google has been switched on once
  with real credentials and got as far as returning a code to our callback,
  which then failed on D-35 — so the provider side is proven and ours is not.
  GitHub is still `enabled: false` and has never been tried. Neither set of
  credentials is committed (D-34), so a fresh clone has neither.
- **Password reset has never been seen to work.** Keycloak had no mail server at
  all until D-33 pointed it at Mailpit, so "Forgot password?" failed every time.
  The realm now carries the setting, but nobody has clicked the link in Mailpit
  and set a new password. Signing out was equally broken until D-32 and is
  equally untried.
- **`docker compose up` needs Compose v2** and has not been run start to finish.
  The file uses `depends_on: condition: service_completed_successfully`, which
  Compose v1.29 cannot parse. The same wiring was checked by starting the
  containers by hand. See [SCOPE.md](SCOPE.md) §8.
- **A deleted request frees its rate-limit slot**, which R-131 says it should
  not. Everything else about the three limits is built and tested.
- **Session refresh is still unproven at the round-trip level.** The access
  cookie outlives every test run, so nothing has ever made the browser renew a
  real session; `11-errors-and-resilience` only proves the interceptor tries
  once and does not loop. Sign-out was in this list too and is now proven —
  `01-authentication` signs out for real and confirms the API refuses the old
  session.

Known limits that are choices, not omissions, are in
[SCOPE.md](SCOPE.md) §2 — no audit log (D-12), no maximum page size (D-04), no
comment threading (D-05), and search without ranking (D-11).

### The front end — the board

- **Search, filter by status and category, sort, and pages**, all of it in the
  web address (R-22). Copy the address and you get the same board back; the back
  button walks the searches.
- **The saved sort and filters seed the board, and the address overrides them**
  (R-24). An explicitly-cleared filter stays cleared, so a shared link cannot
  quietly revert to the recipient's own saved filters.
- **All four states, and the two empty ones read differently.** "No requests
  yet. Be the first." for a new board; "Nothing matches these filters" with a
  Clear button when a filter is what hid everything.
- **A page past the end goes back to the last real page** rather than showing an
  empty page with working pagination underneath (SRS 15.1). At most once, so a
  disagreeing server cannot loop it.
- **A slow answer that arrives after a newer one is dropped**, so typing in the
  search box cannot leave results for words already replaced.
- **A retired category still names the requests that use it** (R-45), because
  the start-up call carries the retired rows too. An id we cannot name shows as
  "Unknown", never as a blank chip.
- **Comment counts disappear from the board when comments are switched off**
  (R-42).
- **The board is a responsive card grid, not a list of rows.** One, two or
  three columns depending on width. Each card is a single clickable target —
  the whole card is the link to the request, via a stretched title link — and
  carries its own vote button, so voting no longer requires opening the
  request first. Voting from a card is optimistic and independently tested
  (`request-card.spec.ts`), sharing its rollback logic with the request page
  through one `VoteService` (`core/requests/vote.service.ts`,
  `vote.service.spec.ts`).
- **A pinned request carries a small pin marker in its top corner** — a filled
  circular badge on the card, plus a tinted card background — replacing the
  old flat "Pinned" text pill.
- **Search and filters live in one toolbar.** The search box and sort control
  are always visible; status and category are Material filter chips behind a
  Filters button that shows how many are active, and every applied filter also
  appears as a small removable chip with a Clear all next to it. The filter
  `<input type="checkbox">` elements are still real checkboxes inside real
  `<fieldset>`s, just visually rebuilt as chips, so the accessibility tree
  (and most of the old Cypress selectors) did not have to change.
- **"New request" and "Edit request" are popups, not pages.** Both open in
  place as a modal dialog (a native `<dialog>`): "New request" over the board,
  so its scroll position and filters are never disturbed; "Edit" over the
  request page, so you stay on the request you are editing. On a new request a
  snackbar offers "View" to jump straight to it; on an edit the page reloads in
  place and a snackbar confirms the save. The route `/requests/new` still
  exists and opens the same dialog, forced open, so a bookmarked link still
  works. The old `/requests/:id/edit` route is gone — edit is only reachable
  from the request page now. The form dialog has no Delete button: deleting a
  request is done from the trash icon in the request header, which asks first
  the same way it always did.

### The front end — a request page

- **Voting is optimistic and rolls back.** The number moves on click (R-30); the
  server's answer replaces the prediction rather than confirming it, because the
  count belongs to the server (R-28). A refusal puts the number back and says
  why, and a rate limit says when they may vote again (R-131).
- **A double click is one vote.** The database guarantees that (R-26); the
  screen adds not sending a second call, which would be an un-vote.
- **The vote button's name says the count and whether you voted** (R-31), so a
  screen reader hears what pressing it did. It works from the keyboard.
- **Comments are cursor-paged, newest first** (R-33b), so a comment arriving
  while somebody reads cannot push a row they have already seen into the next
  block. A repeated id is dropped as well, belt and braces.
- **A new comment appears at the top with no reload and no second call**
  (R-33d), and the box keeps what was typed if saving fails (SRS 15.5).
- **Deleting a comment removes it completely** — from the thread and from the
  database, with no tombstone row (this overrides R-38/R-39; see `DECISIONS.md`).
  Admin "reject" of a waiting comment deletes it the same way. A comment waiting
  for approval is shown to its writer, marked, and not counted (R-40).
- **Every page carries a breadcrumb** from the board down to where you are, so
  the deeper screens (a request, a settings tab, an admin section) show their
  place. Not asked for in the brief — a usability addition.
- **The request and the thread fail independently** (SRS 15.2) — a thread that
  will not load never takes down a page that otherwise works.
- **With comments switched off the thread and box are not rendered at all**, and
  the thread is not even requested (R-42). The server refuses too; the E2E suite
  will prove that half.
- **Descriptions and comments are plain text** (R-98) — markup in a description
  is shown, never executed.

### The front end — writing a request

- **Create, edit and delete your own** (R-10 to R-14), on Angular 22's Signal
  Forms, so every validation rule lives in a schema and is testable without
  rendering a component.
- **Inline messages that say how to fix it**, next to the field, on blur or on
  save — never on every key press (R-88). The cursor goes to the first bad
  field (R-112), and each message is tied to its input with `aria-describedby`.
- **Over the submission limit** names the time they may try again and says
  plainly that nothing they wrote was lost (SRS 15.3, R-131).
- **Deleting asks first**, names the request, and says its votes and comments go
  with it (R-91). One click can never delete.
- **Editing a request that is not yours shows a message and no form at all**
  (SRS 15.2), rather than a form that will fail on save.
- **A category retired while the form was open** asks for another one.

### The front end — profile and admin

- **Profile, language, email choices and account deletion** (R-54 to R-62),
  split into their own small components (`profile-form`, `account-form`,
  `device-preferences-form`, `danger-zone`) under `features/settings/`. The page,
  the user-menu link and the browser tab are titled **Profile**; it lives at
  `/profile` (the old `/settings` path is gone, with no redirect — D-79).
  It opens with an identity header (avatar, name, admin badge) over a sticky
  in-page nav and a stack of section cards. Each part saves on its own and says
  so in a footer bar, so one failing part cannot make another look unsaved.
  Deleting an account says what will happen *before* anything is pressed, in a
  red-toned card, and goes through the same confirm dialog as every other
  destructive action in the app, rather than the old "type DELETE" box — one
  fewer pattern for a person to learn. The last admin is refused with the
  reason (R-62).
- **The choices that live in this browser** — theme, default sort and default
  filters (D-06) — sit under an **Appearance and defaults** card, kept apart
  from the account-level choices above it.
- **Categories and statuses** (R-43 to R-49), with the count of what uses each
  one (SRS part 7). Delete is not offered for a row in use; retire is, and now
  asks first. The first status offers no Retire button at all (R-48).
- **Application settings** — sign-up rule, allowed domains, comment approval,
  all six rate limits, and the comments feature switch (R-67 to R-70), now
  three section cards (`registration-card`, `comments-card`,
  `rate-limits-card`) instead of one long form. A limit below 1 is refused
  before it is sent, because zero would mean nobody can write (R-130).
- **Waiting comments**: approve or reject (R-41), each behind its own confirm
  dialog now. There is deliberately no edit — an admin never rewrites what
  somebody said (R-36).
- **Invitations**: invite, see whether it was used, withdraw (R-66) — withdraw
  now asks first too.
- **Status and pin on a request** (R-64, R-65), shown to admins only as a
  courtesy — the server refuses both to anybody else (R-70).

### The front end — everything else

What is left, now that the request form, the admin screens and the moderation
queue are built and driven end to end:

- **Editing your own comment has no UI** (R-35). The `PATCH /v1/comments/:id`
  endpoint works and refuses everyone but the author — `04-comments` proves it —
  but the request page offers only Delete, never an inline edit. Deleting is
  built (R-37), and an admin can delete any (R-37) — a delete is a real row
  delete now, not a grey line.
- **The board has no admin status control.** R-64 asks for the status to be
  changeable from the board as well as the request page; only the request page
  has it. The end-to-end suite covers A-2 through the request page, so the
  journey is proven and this half of the rule is not.
- **Arabic has never been looked at in a real browser.** Every string is
  translated, the dictionaries are typed against each other and tested for
  parity, and `I18nStore` flips `<html lang>`/`<html dir>` and is unit-tested
  doing it — but nobody has switched the running app to Arabic in a browser and
  looked at it, so a control that overflows, a chip that does not mirror, or an
  icon that should flip and does not could still be there. `[dir='rtl']
  .rtl-flip svg { transform: scaleX(-1) }` mirrors the pagination chevrons on
  purpose; nothing else was checked by eye.
- **The Cypress suite (`e2e/`) was not touched in this redesign** and was not
  run against it either — see the end-to-end tests section above. It is not
  evidence for or against the new UI right now.
- **The old design system (`tokens.css`, the old `state-panels.ts`, the raw
  Tailwind utility classes on hand-written `<button>`/`<select>` elements) is
  gone.** Every screen was rebuilt; nothing was reskinned in place. Anything not
  mentioned as changed above (the guards, the stores, the interceptor, the
  bootstrap sequence, the API contract) was left exactly as it was — this was a
  presentation-layer rebuild, not a rewrite of the app's logic.

Two smaller things that are true and easy to miss:

- `docker compose up --build` may fail to *rebuild* on a snap-installed
  `docker-compose`, which cannot read files under `/media` (permission denied).
  `podman-compose` is the workaround. Containers already built run fine.
- The API image currently running may serve an older OpenAPI document than the
  source produces. Rebuild it before regenerating the front-end types.

## How to run it

Needs **Docker Compose v2** (`docker compose`, not `docker-compose`).

```bash
docker compose up --build -d --wait
```

That is the whole command. There is no `.env` to prepare first: every value the
compose file needs is written inside it, because they are all development
values. It starts Postgres, Redis, Keycloak and Mailpit, runs the migration and
the seed as their own step, and only then starts the API and the email worker.
`-d` leaves the stack running in the background, and `--wait` returns only after
the health checks pass.

| What | Where |
|---|---|
| Web app | http://localhost:4200 |
| API | http://localhost:3000/v1 |
| API docs | http://localhost:3000/api/docs |
| Keycloak | http://localhost:8080 (admin / admin) |
| Mailpit | http://localhost:8025 |

On this machine, `docker` is a Podman wrapper that delegates compose to a
snap-packaged `docker-compose`, and that wrapper cannot read projects under
`/media`. Use this equivalent one-command start instead:

```bash
podman-compose up --build -d
```

Seeded accounts, all with the password `Passw0rd!`:

| Email | Role |
|---|---|
| `admin@feedbackhub.local` | admin |
| `sam@feedbackhub.local` | normal |
| `rae@feedbackhub.local` | normal |

Their Keycloak ids are pinned so the seeded requests, votes and comments belong
to them on the first run (D-26).

### If `docker compose` is version 1

Compose v1 cannot parse this file (see [SCOPE.md](SCOPE.md) §8). You can still
run everything by hand — this is the exact sequence that was used to check it:

```bash
podman network create fh-net

# 5433, not 5432: many machines already have a Postgres on 5432. Use whatever
# is free — only the DATABASE_URL you give the API has to agree with it.
podman run -d --name fh-pg --network fh-net -p 5433:5432 \
  -e POSTGRES_USER=feedbackhub -e POSTGRES_PASSWORD=feedbackhub \
  -e POSTGRES_DB=feedbackhub postgres:16-alpine

podman run -d --name fh-redis --network fh-net -p 6379:6379 redis:7-alpine
podman run -d --name fh-mail  --network fh-net -p 8025:8025 -p 1025:1025 axllent/mailpit

podman run -d --name fh-kc --network fh-net -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -e KC_HEALTH_ENABLED=true \
  -e KC_HOSTNAME=http://localhost:8080 -e KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true \
  -v "$PWD/infra/keycloak/realm:/opt/keycloak/data/import:ro,Z" \
  quay.io/keycloak/keycloak:26.0 start-dev --import-realm

# the migration and the seed, as their own step (R-82)
podman build -f infra/docker/api/migrate.Dockerfile -t feedbackhub-migrate:local .
podman run --rm --network fh-net \
  -e DATABASE_URL=postgresql://feedbackhub:feedbackhub@fh-pg:5432/feedbackhub \
  feedbackhub-migrate:local

podman build -f infra/docker/api/Dockerfile -t feedbackhub-api:local .
podman run -d --name fh-api --network fh-net -p 3000:3000 \
  -e NODE_ENV=production -e PORT=3000 \
  -e DATABASE_URL=postgresql://feedbackhub:feedbackhub@fh-pg:5432/feedbackhub \
  -e REDIS_URL=redis://fh-redis:6379 \
  -e APP_BASE_URL=http://localhost:4200 \
  -e AUTH_ALLOWED_ORIGINS=http://localhost:4200 -e AUTH_COOKIE_SECURE=false \
  -e OIDC_ISSUER_URL=http://fh-kc:8080/realms/feedbackhub \
  -e OIDC_CLIENT_ID=feedbackhub-api \
  -e OIDC_CLIENT_SECRET=local-development-only-secret \
  -e OIDC_REDIRECT_URI=http://localhost:3000/v1/auth/callback \
  -e SMTP_HOST=fh-mail -e SMTP_PORT=1025 -e SMTP_TIMEOUT=10 -e MAIL_ENABLED=true \
  -e "SMTP_FROM=FeedbackHub <no-reply@feedbackhub.local>" \
  feedbackhub-api:local
```

Swap `podman` for `docker` if you have Docker. Note `OIDC_ISSUER_URL` uses the
container name while `KC_HOSTNAME` is `localhost` — that is deliberate, and D-28
explains why.

### Running the API from source, against those containers

Useful while developing: the API restarts on every save, and you can put a
breakpoint in it. Everything else still runs as a container.

**Step 1 — the database.** Two ways, and the second is nicer if you already run
PostgreSQL and use a client like pgAdmin.

*Either* use the container from the block above (it publishes 5433),

*or* create the database inside the PostgreSQL you already have, so it sits on
the normal port beside your others and shows up in your existing client. One
statement, as a superuser — in pgAdmin: right-click the `postgres` database →
Query Tool → paste → F5, or from a terminal:

```bash
psql -h localhost -U postgres -c "CREATE DATABASE feedbackhub;"
```

Nothing else to set up: the app connects as that server's superuser, and Prisma
creates the tables. On a real server it would get a role that owns its own
database and nothing more — [`scripts/create-local-database.sql`](scripts/create-local-database.sql)
says why that matters and why it does not here.

**Step 2 — start Redis, Keycloak and Mailpit** from the block above. Those have
no equivalent already on your machine, so they stay containers. Skip the
Postgres container if you took the second path.

**Step 3 — make your `.env`:**

```bash
cd apps/api
cp .env.example .env
```

**Step 4 — fill in the values that depend on your machine.** Everything else in
the example file already works as it stands.

| Variable | Set it to | Why |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:root@localhost:5432/feedbackhub` for your own PostgreSQL — user, password and port as that server has them — or `postgresql://feedbackhub:feedbackhub@localhost:5433/feedbackhub` for the container | Whichever you chose in step 1. Getting this wrong is the one mistake that looks like the app is broken when it is only pointed elsewhere. |
| `REDIS_URL` | `redis://localhost:6379` | Already correct if 6379 was free. |
| `OIDC_ISSUER_URL` | `http://localhost:8080/realms/feedbackhub` | `localhost`, because the API is on your machine now. The container version uses `fh-kc` instead — that difference is the whole of D-28. |

Leave `OIDC_CLIENT_SECRET` as it is: the realm file ships with that exact value,
so the two already agree. `AUTH_COOKIE_SECURE=false` is right for localhost and
wrong everywhere else. `MAIL_ENABLED=true` sends into Mailpit, where nothing
leaves your machine.

The file is read twice — by the API and worker (through `import 'dotenv/config'`
at the top of `main.ts`), and by the Prisma CLI, which finds it by itself. A
variable already set in your shell always beats the file, so a container ignores
it completely.

**Step 5 — install, generate, migrate, seed, run:**

```bash
npm install
npx prisma generate           # builds the typed client from schema.prisma
npx prisma migrate deploy     # creates the nine tables, indexes and constraints
npx ts-node prisma/seed/seed.ts   # 3 users, 4 requests, 4 votes, 3 comments…
npm run start:dev             # http://localhost:3000
```

`migrate deploy` and the seed are safe to re-run; the seed is upserts only, so
running it twice leaves the same rows.

If the environment is wrong the API refuses to start and prints **every**
problem at once, naming each variable — that is deliberate (R-102), so you fix
them in one pass instead of one boot at a time.

### Checking it works

```bash
curl -s localhost:3000/health/live      # {"status":"ok"}
curl -s localhost:3000/health/ready     # database, redis and identityProvider all "up"
curl -s localhost:3000/v1/bootstrap     # 401 — you are not signed in yet
curl -sI localhost:3000/api/docs        # 200 — Swagger, generated from the routes
```

Then open http://localhost:3000/v1/auth/sign-in in a browser: it should land on
Keycloak's own login page, where `sam@feedbackhub.local` / `Passw0rd!` signs you
in and returns you with the session cookies set.

Everything above was run and checked, up to and including the login page
rendering. Typing the password and coming back through the callback is the one
step nobody has done yet.

### The front end

The web app needs a newer Node than the API does: Angular 22 requires
`^22.22.3 || ^24.15.0 || >=26.0.0`, and 22.18 is **not** enough — the CLI
refuses to start. `nvm install 22` gets a version that works.

```bash
cd apps/web
npm install
npm start          # http://localhost:4200
```

`npm start` proxies `/v1` and `/health` to `http://localhost:3000`, so the
browser sees one origin and the auth cookies behave the way they will in
production (R-3h). The API must already be running.

The typed API client is generated from the live API, not hand-written:

```bash
npm run api:types        # regenerate src/app/core/api/schema.d.ts
npm run api:types:check  # regenerate and fail if it has drifted (CI)
```

## How to run the tests

These all work now, from a fresh clone, on a machine with Node 22 and a
container runtime.

```bash
cd apps/api
npm install
npx prisma generate

npm run verify            # everything below, in order
```

Or one layer at a time:

```bash
npm run lint              # ESLint; bans `any` at every edge
npm run depcruise         # the module seams and the dependency rule
npm test                  # unit: domain and use cases, no database
npm run test:integration  # real PostgreSQL 16 + Redis 7 via Testcontainers
npm run test:api          # the whole guard chain, via Supertest
```

Today that is **297 tests**: 130 unit, 36 integration, 131 API. The whole run
takes about four minutes, most of it starting containers.

### If you use podman rather than Docker

Use `podman-compose` directly, not `podman compose`. The second one hands the
job to whatever compose provider it finds on the PATH, and if that is the
snap-packaged `docker-compose`, the snap is confined and cannot read a project
stored under `/media` — it fails with `permission denied` on
`docker-compose.yml`, a file you can read perfectly well yourself. Either call
`podman-compose` by name, or pin it once:

```bash
mkdir -p ~/.config/containers
printf '[engine]\ncompose_providers = ["/usr/bin/podman-compose"]\n' \
  >> ~/.config/containers/containers.conf
```

The tests need no setup: the harness finds a rootless podman socket by
itself (D-23). One cost you should know about — Testcontainers' cleanup
container cannot run rootless, so it is switched off, and a test run killed
part-way can leave a container behind:

```bash
npm run test:clean        # remove leftover test containers
```

### The front-end tests

```bash
cd apps/web
npm test           # Vitest, through Angular's own unit-test builder
```

240 tests. They go through what a person sees — role, label and visible text,
never a CSS class — and cover the browser-side preferences, the error shape, the
one start-up call, the session renewal, the guards, the i18n store and its two
dictionaries, the shared design-system components (button, menu, dialog,
confirm service, vote service), the board, the request card, the request form
dialog, and the settings screen. The admin screens carry no component-level
tests of their own — same as before the redesign — only `admin.store.spec.ts`
does, and that store was not touched.

Angular 22 needs Node 22.22.3 or newer. On an older one the CLI stops with a
message about Node, not about the code.

### The end-to-end tests (R-159)

These run a real browser (Cypress) against the whole stack from
`docker-compose.yml`: the real Angular build served by nginx, the real API, the
real Postgres, the real Redis and the real Keycloak. Nothing is mocked, and
sign-in goes through the real Keycloak login form with a seeded account
(R-160) — a faked cookie would remove the one thing these tests exist to prove.

**These specs target the pre-redesign UI and have not been run since.** The
redesign kept the ids and structure most of them depend on — `#board-search`,
`#board-sort`, the `<fieldset>` filter groups, `<article>` cards — on purpose,
but the header (a user menu instead of loose buttons), the new-request flow (a
popup instead of a page), and the confirm dialogs in front of delete/approve/
reject are all new, and specs written against the old versions of those will
need updating before this suite means anything again.

```bash
docker compose up --build -d --wait   # from the root; --wait holds until healthy

cd e2e
npm ci
npm run typecheck   # the specs are type-checked as one program
npm test            # the whole suite, headless
npm run test:open   # the Cypress runner, for writing or debugging one
```

**80 tests across 15 spec files, about nine minutes.** Sign-in cost is real —
each persona signs in once per spec through Keycloak — but a `cy.session` cache
keeps it to one login per persona per file. What they cover:

| File | What it proves |
|---|---|
| `00-smoke-and-navigation` | Every route loads: board, request, new-request form, settings, not-found, not-allowed, deep links, a retired taxonomy value still labelled on an old request. |
| `01-authentication` | U-1: sign-in through Keycloak, no token in `localStorage`/`sessionStorage` (R-3c), both cookies HttpOnly with the right `SameSite` and path (R-3d, R-3e), exactly one `/bootstrap` call (H-4), sign-out clears the session, a signed-out call is 401. |
| `02-board` | R-16 to R-25: search by title and description, sort and its URL, a category filter that survives reload, pinned-first ordering, an honest empty state, a bookmarked empty page. |
| `03-requests` | R-10 to R-14: validation, create, owner edit, no owner controls on someone else's, and the API refusing a cross-user edit or delete with 403. |
| `04-comments` | R-32 to R-42: publish when approval is off, the author editing their own at the API, admin moderation, approve and reject a waiting comment, and the feature switch removing the thread **and** making the server refuse a comment with `FEATURE_DISABLED`. |
| `05-votes-and-interactions` | R-26 to R-31: vote and un-vote in the UI, idempotent double-vote at `POST /v1/requests/:id/vote`, and the vote rate limit with `retryAt`. |
| `06-settings` | R-54 to R-60: display name persists, an explicit theme survives reload, a notification toggle saves. |
| `07-admin-taxonomy` | R-43 to R-49, R-64, R-65: usage counts, add/retire/restore/delete an unused category, no Delete for one in use, the first status protected from retirement, status change and pin. |
| `08-admin-settings-and-invitations` | R-66 to R-70, R-130: a limit that takes effect with no restart, a zero refused in the UI, invite-only, create and cancel an invitation, and 403 for an ordinary user. |
| `09-authorization` | R-70, R-66 from the other side: an ordinary session calling every admin endpoint by hand and being refused. Plus the origin check (R-3g). |
| `10-rate-limits` | R-130 to R-132: the submission limit refuses the one past it, says when to try again, and applies to an admin too. |
| `11-errors-and-resilience` | SRS 15.8: a failed start-up shows an error with a working Try again, no stack leaks, a board error does not trigger the auth refresh, and a 401 does not loop. |
| `12-api-contracts-and-state` | The real `/bootstrap` and request-detail shapes, and payload validation on comments and requests. |
| `13-admin-comments-and-workflow` | The review board filter, an admin inspecting a comment without an inline rewrite control (R-36), and the waiting-comments nav appearing only with approval on. |
| `14-complete-critical-journeys` | The two headline journeys end to end: a user creating, voting, commenting, editing and signing out; an admin reviewing, changing status, pinning and touching settings and taxonomy. |

Two things worth knowing before you read the code:

- **One run, no retries.** These tests share one database, so parallel runs
  would make failures that depend on the order things happened to run. A retry
  would hide a flake, and a flake in a suite this small is a real defect.
- **Some specs change an application setting and put it back.** The comment
  specs toggle the approval and feature switches; the rate-limit specs set a
  limit of their own. Each restores the value it read at the start, so a
  half-finished run can leave a setting changed — re-seeding (`docker compose
  up`) resets it.

If the stack is not up, sign-in fails on the first spec with a Keycloak
connection error.

**Environment gotcha:** if your shell exports `ELECTRON_RUN_AS_NODE=1`, Cypress's
bundled Electron refuses to start (`bad option: --no-sandbox`). Unset it for the
run: `env -u ELECTRON_RUN_AS_NODE npm test`. On a headless machine, wrap the
command in `xvfb-run -a`.

## Configuration

Every variable, what it is for, and its default: [`apps/api/.env.example`](apps/api/.env.example).

Two rules that will not bend:

- Product settings never come from the environment. The sign-up rule, the
  feature switch and the six rate-limit numbers live in the database, so an
  admin changes them with no restart.
- No secret has a default. A missing one stops the boot, loudly, rather than
  surfacing at the first request that needed it.

## Commit convention

AI-heavy commits carry the trailer `Co-Authored-By: Claude Opus 5` in the commit
message. Commits without it are hand-written. The convention starts from the
first code commit; the initial docs commit predates it.

This section used to say the trailer was `AI-Assisted: <tool>`. It never was —
no commit has ever carried that trailer. The README was describing a convention
the history did not follow, which is worse than having none, so the text now
says what `git log --format='%(trailers)'` actually shows.

---

## Documents

| File | What is in it |
|---|---|
| [DECISIONS.md](DECISIONS.md) | The choices that mattered, and why. |
| [SCOPE.md](SCOPE.md) | What we build, what we skip, what we assume. |
| [AI_COLLABORATION.md](AI_COLLABORATION.md) | How I worked with AI. Written by hand. |
| [CLAUDE.md](CLAUDE.md) | Rules for keeping these documents true. |
| [references/SRS.pdf](references/SRS.pdf) | Full requirements, 38 pages, with numbered rules (R-nn). |
| [references/FeedbackHub-Assignment.pdf](references/FeedbackHub-Assignment.pdf) | The original brief. |
