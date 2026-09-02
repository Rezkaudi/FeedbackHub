# FeedbackHub

An internal product feedback board.

People post feature requests and feedback. Everyone can read them, upvote them,
and comment. An admin sets the status, curates categories and statuses,
moderates comments, and configures the app.

The goal: stop the same idea arriving five times by email, and make it visible
what is being worked on.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Front end | Angular 22, standalone components, signals, Tailwind, Material Design 3 | D-16, D-36, D-38 |
| Back end | Node.js 22, NestJS 11, TypeScript strict | D-17 |
| Architecture | Modular monolith (9 modules) + 1 email worker | D-18 |
| Database | PostgreSQL 16 + Prisma 6 (raw SQL for the board query) | D-19 |
| Shared state | Redis 7 (rate limits, email queue) | D-20 |
| Sign-in | Keycloak (OIDC), self-hosted | D-21 |
| Mail | SMTP, Mailpit locally | D-21 |
| Tests | Jest, Testcontainers, Supertest, Angular Testing Library, Cypress | D-22, D-48 |
| Packaging | Docker, Docker Compose, Kubernetes (kustomize) | D-18 |

Reasons for each choice are in [DECISIONS.md](DECISIONS.md).

---

## Architecture

One deployable API, split inside into modules with real walls. A second process
runs the same image with a different command and only sends email.

```mermaid
flowchart TB
    B["Browser — Angular SPA"]
    N["nginx :4200<br/>serves the build, proxies /v1"]
    KC["Keycloak :8080<br/>OIDC, the only place a password is seen"]

    subgraph API["API — NestJS :3000"]
        direction TB
        G["Guards: signed in 401 → Origin 403 → admin 403"]
        M["Modules: identity · requests · votes · comments<br/>taxonomy · settings · invitations<br/>notifications · bootstrap"]
        G --> M
    end

    W["Worker — same image<br/>node dist/worker.js"]
    PG[("PostgreSQL 16")]
    RD[("Redis 7<br/>rate limits + job queue")]
    SMTP["SMTP / Mailpit :8025"]

    B -->|same origin| N
    N -->|/v1| API
    B -->|sign-in redirect| KC
    API -->|token check| KC
    API --> PG
    API --> RD
    RD -->|job| W
    W --> PG
    W --> SMTP
```

Rules that hold the shape:

- Each module is `domain / application / infrastructure / http`. The domain has
  no framework imports. Use cases talk to **ports**; Prisma sits behind them.
- A module never imports another module's inside. It goes through a published
  `contract.ts` / service. `npm run depcruise` fails the build if this breaks.
- Authorization is always on the server, in guards and use cases. The UI only
  hides what the server already refuses.
- Vote count and comment count are **not** stored columns. They are counted, so
  they cannot drift.
- One error shape everywhere: machine code, message, field errors, request id.
- The browser never holds a token. Two httpOnly cookies do (D-01).
- The front end starts with **one** call, `/v1/bootstrap`: the user, the
  taxonomy, and the settings in a single response — no chain of blocking calls.

Why a monolith and not services: D-18.

## The data model (ERD)

Nine tables. No more, no fewer.

```mermaid
erDiagram
    users ||--o| user_settings : "has one"
    users ||--o{ feedback_requests : "writes"
    users ||--o{ comments : "writes"
    users ||--o{ votes : "casts"
    categories ||--o{ feedback_requests : "classifies"
    statuses ||--o{ feedback_requests : "tracks"
    feedback_requests ||--o{ votes : "receives"
    feedback_requests ||--o{ comments : "receives"

    users {
        uuid id PK
        string external_id UK "the id Keycloak gave"
        string email UK
        bool email_verified
        string display_name
        string avatar_url "empty = draw initials"
        enum role "user | admin"
        enum status "active | deleted"
        timestamptz created_at
    }
    user_settings {
        uuid user_id PK,FK "cascade with the person"
        enum language "null = code default"
        bool notify_on_comment
        bool notify_on_status_change
    }
    app_settings {
        int id PK "CHECK (id = 1) — one row only"
        enum registration_policy "open | invite_only | domain_restricted"
        string_array allowed_email_domains
        bool comments_require_approval
        bool feature_comments_enabled "the feature flag"
        int signup_limit_count "+ 5 more limit columns"
    }
    categories {
        uuid id PK
        string name UK "unique on lower(name)"
        string slug UK
        string color "never colour alone"
        bool is_active "false = retired, not deleted"
    }
    statuses {
        uuid id PK
        string name UK
        string slug UK
        bool is_default "partial unique index: exactly one"
        bool is_active "the default can never be retired"
    }
    feedback_requests {
        uuid id PK
        string title "5..120"
        string description "plain text"
        uuid category_id FK "RESTRICT"
        uuid status_id FK "RESTRICT"
        uuid author_id FK "RESTRICT"
        bool is_pinned
        timestamptz pinned_at
        timestamptz created_at
    }
    votes {
        uuid id PK
        uuid request_id FK "cascade"
        uuid user_id FK "cascade"
        timestamptz created_at
    }
    comments {
        uuid id PK
        uuid request_id FK "cascade"
        uuid author_id FK "RESTRICT"
        string body "empty when deleted"
        enum state "published | pending | deleted"
        timestamptz created_at
    }
    invitations {
        uuid id PK
        string email UK "no FK: matches users.email"
        timestamptz accepted_at
    }
```

Four things the diagram cannot show, and they matter:

- **No vote-count or comment-count column.** Both are counted from the rows on
  every read, so they cannot drift.
- **`votes` has a unique index on `(request_id, user_id)`.** That one line is
  what makes "one vote per person" true with ten clicks in the same second — the
  database refuses the second, not the code.
- **`statuses` has a partial unique index `WHERE is_default`.** Exactly one
  default status, enforced by the database, so marking a new one must un-mark
  the old one in the same transaction.
- **RESTRICT vs cascade is a decision, not a default.** A category or status in
  use can never be deleted, only retired. Deleting an account wipes the person
  but keeps their content; their votes go with them, because a vote is a
  personal signal, not content.

## How signing in works

No password ever reaches our API, and the browser never holds a token.

```mermaid
sequenceDiagram
    autonumber
    participant U as Person
    participant W as Angular app
    participant A as API
    participant K as Keycloak
    participant D as PostgreSQL

    U->>W: opens the app
    W->>A: GET /v1/bootstrap
    A-->>W: 401 — not signed in
    W->>A: GET /v1/auth/sign-in
    A-->>U: redirect to Keycloak (PKCE S256)
    U->>K: types email + password
    K-->>A: redirect to /v1/auth/callback?code=...
    A->>K: exchange code for tokens (client secret, server side only)
    K-->>A: access + refresh token
    A->>D: match on external_id, apply the sign-up policy
    D-->>A: the user row
    A-->>U: two httpOnly cookies, redirect to the app
    W->>A: GET /v1/bootstrap
    A-->>W: user + taxonomy + settings, in one response
```

Later, when the access cookie has expired, the app's interceptor calls
`POST /v1/auth/refresh` **once**. If that fails too, the person is sent back to
sign in — they never see a raw 401.

## Folder structure

```
apps/
  api/                     NestJS API + email worker
    prisma/                schema, migrations, seed
    src/modules/<name>/    domain | application | infrastructure | http | tests
    src/shared/            config, auth guards, errors, logging, redis, rate limit
    test/support/          integration + API test helpers
  web/                     Angular SPA
    src/app/core/          api types, auth, bootstrap store, i18n, config, errors
    src/app/features/      board, request-detail, request-form, settings, admin, ...
    src/app/shared/ui/     design-system components
    src/styles/tokens/     Material 3 design tokens
e2e/                       Cypress suite (own package), 00-smoke .. 09-experience
infra/
  docker/                  API, migration and web images + nginx config
  k8s/                     base + local overlay (API, worker, migration Job)
  keycloak/realm/          realm export: client, roles, seeded accounts
scripts/                   create-local-database.sql
.github/workflows/ci.yml   lint, seams, types, all test layers, images, e2e
```

---

## How to run it

Needs **Docker Compose v2** (`docker compose`, not `docker-compose`).

```bash
docker compose up --build -d --wait
```

That is the whole thing. No `.env` to prepare: every value in the compose file
is a development value. It starts Postgres, Redis, Keycloak and Mailpit, runs
the migration and the seed as their own step, then starts the API, the worker
and the web app.

| What | Where |
|---|---|
| Web app | http://localhost:4200 |
| API | http://localhost:3000/v1 |
| API docs (OpenAPI) | http://localhost:3000/api/docs |
| Keycloak | http://localhost:8080 (admin / admin) |
| Mailpit (email inbox) | http://localhost:8025 |

Seeded accounts, password `password` for all:

| Email | Role |
|---|---|
| `admin@feedbackhub.local` | admin |
| `bo@feedbackhub.local` | admin |
| `sam@feedbackhub.local` | user |
| `rae@feedbackhub.local` | user |

Their Keycloak ids are pinned so the seeded requests, votes and comments belong
to them on the first run (D-26).

### Turning on Google sign-in

The realm defines one social provider, **Google**, and it is `enabled`. Its
credentials are **empty on purpose** — a real client id and secret must never be
committed:

```jsonc
// infra/keycloak/realm/feedbackhub-realm.json
"identityProviders": [
  {
    "alias": "google",
    "providerId": "google",
    "enabled": true,
    "trustEmail": true,
    "config": {
      "clientId": "",        // <- put yours here
      "clientSecret": "",    // <- and here
      "defaultScope": "openid email profile"
    }
  }
]
```

Until those two are filled in, the Google button appears on the Keycloak login
page and fails when clicked. To make it work:

1. In the Google Cloud console, create an OAuth client (type: **Web
   application**) and register this redirect URI — it points at **Keycloak**,
   not at our API, which only ever sees the end of the handshake:

   ```
   http://localhost:8080/realms/feedbackhub/broker/google/endpoint
   ```

2. Put the client id and secret into the two empty fields above, then recreate
   the stack so the realm is imported again:

   ```bash
   docker compose down -v && docker compose up --build -d --wait
   ```

   Or, without touching the file: Keycloak admin console (http://localhost:8080,
   admin / admin) → Identity providers → Google → set the id and secret. That
   way nothing lands in Git, but the change is lost when the volume is dropped.

Google is set to `trustEmail: true`, so a Google account counts as a verified
email — which matters under the `domain_restricted` sign-up policy, since it
refuses an unverified email even on an allowed domain.

**Never commit real credentials.** CI fails the build if anything that looks
like a secret is committed.

With podman, call `podman-compose` by name:

```bash
podman-compose up --build -d
```

Stop and wipe:

```bash
docker compose down -v      # -v also drops the database volume
```

### Running from source (for development)

**1 — start the services only:**

```bash
docker compose up -d postgres redis keycloak mailpit
```

**2 — create the database and the env file.** The compose Postgres already has
the `feedbackhub` database. For your own Postgres:

```bash
psql -U postgres -f scripts/create-local-database.sql
```

```bash
cp apps/api/.env.example apps/api/.env
```

Then edit `apps/api/.env` — the addresses assume the API runs on your machine
and the rest in containers:

```
DATABASE_URL=postgresql://feedbackhub:feedbackhub@localhost:5433/feedbackhub
REDIS_URL=redis://localhost:6379
OIDC_ISSUER_URL=http://localhost:8080/realms/feedbackhub
OIDC_CLIENT_SECRET=local-development-only-secret
```

(Compose publishes Postgres on **5433**, not 5432, so it does not clash with a
Postgres you already run.)

**3 — migrate, seed, run:**

```bash
cd apps/api
npm install
npx prisma generate
npm run prisma:migrate     # apply migrations
npm run prisma:seed        # taxonomy, accounts, example requests
npm run start:dev          # API on :3000
npm run start:worker       # email worker, in a second terminal (after `npm run build`)
```

**4 — the front end** (needs Node 22.22.3+, Angular 22 refuses older):

```bash
cd apps/web
npm install
npm start                  # http://localhost:4200
```

`npm start` proxies `/v1` and `/health` to `http://localhost:3000`, so the
browser sees one origin and the cookies behave as they will in production.

The typed API client is generated, not hand-written:

```bash
npm run api:types          # regenerate src/app/core/api/schema.d.ts
npm run api:types:check    # fail if it has drifted (CI)
```

### Check it is alive

```bash
curl -s localhost:3000/health/live      # {"status":"ok"}
curl -s localhost:3000/health/ready     # database, redis, identityProvider
curl -s localhost:3000/v1/bootstrap     # 401 until you sign in
```

### On Kubernetes

`infra/k8s/` covers the **app tier only** — API (2 replicas), worker, and a
migration Job that every API pod waits for through an initContainer. It does
**not** carry Postgres, Redis, Keycloak, Mailpit, the web app or an Ingress.

```bash
kind create cluster --name feedbackhub
kubectl apply -k infra/k8s/overlays/local
```

Not run here — see [SCOPE.md](SCOPE.md) §5.

---

## How to run the tests

Backend (Node 22 + a container runtime; Testcontainers finds podman by itself):

```bash
cd apps/api
npm install && npx prisma generate

npm run verify             # everything below, in order
```

One layer at a time:

```bash
npm run lint               # ESLint, bans `any` at the edges
npm run depcruise          # the module seams and the dependency rule
npm test                   # unit: domain + use cases, no database
npm run test:integration   # real PostgreSQL 16 + Redis 7 (Testcontainers)
npm run test:api           # the whole guard chain, via Supertest
npm run test:clean         # remove containers left by a killed run
```

Front end:

```bash
cd apps/web
npm test                   # Vitest, through role/label/visible text only
```

End to end (real browser, whole stack, nothing mocked — sign-in goes through
the real Keycloak form):

```bash
docker compose up --build -d --wait
cd e2e && npm ci && npx cypress install

npm test                   # headless, the whole suite
npm run test:open          # open the Cypress app and watch the tests run
npm run test:smoke         # one group; also :auth :board :requests :comments
                           # :profile :admin :cross-role :hardening :experience
```

`npm run test:open` is the one to use while writing or debugging a spec: it
opens the Cypress window, re-runs a spec on every save, and lets you step back
through each command. It needs a desktop session. On a headless machine run
`npm run test:local` instead, which wraps the headless run in `xvfb-run`.

Both `test:open` and `test:local` clear `ELECTRON_RUN_AS_NODE` first. If that
variable is set — some editors and terminals export it — Cypress starts as a
plain Node process and exits without opening anything.

See [`e2e/README.md`](e2e/README.md) for what the 47 spec files cover.

CI (`.github/workflows/ci.yml`) runs all of it on every push, plus a check that
no secret is committed and that the API image does not run as root.

---

## Configuration

Every variable with a comment: [`apps/api/.env.example`](apps/api/.env.example).
The main ones:

| Variable | What |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `APP_BASE_URL` | Where the browser reaches the app |
| `AUTH_ALLOWED_ORIGINS` | Origin allowlist. No default; empty or `*` stops the boot |
| `AUTH_COOKIE_*` | Cookie names, lifetimes, path, `secure` flag |
| `OIDC_ISSUER_URL` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_REDIRECT_URI` | Keycloak |
| `SMTP_*`, `MAIL_ENABLED` | Outgoing mail |
| `REQUEST_BODY_LIMIT`, `LOG_LEVEL`, `PORT`, `NODE_ENV` | Limits and runtime |

Two rules that do not bend:

- **Product settings never come from the environment.** The registration policy,
  the feature flag and the six rate-limit numbers live in the database, so an
  admin changes them with no restart. The environment holds addresses and
  secrets only.
- **No secret has a default.** A missing one stops the boot loudly, and every
  problem is reported at once.

---

## What works

**Auth and security**

- Sign-in and sign-out through Keycloak (email + password), proven end to end.
- **Google sign-in**, once real credentials are put in the realm — checked by
  hand, not by a test. See "Turning on Google sign-in" above.
- No token anywhere JavaScript can read: two httpOnly cookies, and the access
  cookie is renewed by the API.
- Guard chain on every write: signed in (401) → Origin check (403) → admin (403).
- Registration policy: open, invite-only, or restricted to email domains.
- Three sliding-window rate limits in Redis: sign-ups, submissions, votes.
- Helmet, CSP, compression, a request id on every call and in every log line,
  with cookies, tokens and emails redacted.

**Board and requests**

- List with sort, filter by status and category, text search, paging, and a
  "my requests" filter. Pinned requests first, with a divider.
- Create, edit and delete your own request; admins can act on any.
- Admin: change status, pin, and moderate.
- One vote per person per request, enforced by a unique index, not by code.

**Comments**

- Write, edit, delete; newest first, cursor paging.
- Optional admin approval, plus a moderation queue. An admin's own comment
  never waits.
- A feature flag that turns comments off across the whole app.

**Taxonomy and settings**

- Admin adds, edits, retires and deletes categories and statuses. A row in use
  cannot be deleted, only retired. Exactly one default status, enforced by a
  partial unique index.
- Admin settings: registration policy, comment approval, rate limits, feature flag.
- User settings: display name, avatar or initials, theme, language, default
  sort and filters, email preferences, account deletion.
- Settings resolve as: code default → app setting → user override. The front end
  gets all of it in one `/v1/bootstrap` call, and a save writes back into that
  snapshot so the UI updates with no page refresh.

**Email**

- Comment, status-change and invitation emails, queued in Redis and sent by a
  separate worker. Watched landing in Mailpit.

**Experience**

- English and Arabic, with real RTL. Missing translations are a build failure.
- Loading, empty and error states everywhere; error messages a person can act on.
- Keyboard accessible, responsive, light/dark/system theme, Material 3 tokens.

**Ops**

- Split liveness and readiness probes, non-root images, migration as its own
  step (never at API start-up), OpenAPI generated from the routes.

## What is not finished

Nothing is hidden — it is all in one place, [SCOPE.md](SCOPE.md) §5: no real
SMTP server has been contacted, the Kubernetes manifests have never been applied
to a cluster, and Google sign-in needs credentials before it works. The limits
that were choices rather than omissions — no audit log, no maximum page size, no
comment threading, no similar-request suggestions, no in-app notifications,
search without ranking — are in [SCOPE.md](SCOPE.md) §2, each with its reason.

---

## Commit convention

AI-heavy commits carry this trailer in the commit message:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**The convention was not kept, and this section says so rather than claiming
otherwise.** `git log --format='%(trailers:key=Co-Authored-By)'` shows the
trailer on **7 of 47 commits**, all of them on 30 August 2026, from `0166a94`
(the backend) to `13fd51f` (the app shell). Every commit after that carries no
trailer — including work that was heavily AI-assisted, such as the Material
Design 3 redesign and the Cypress rewrite.

So, plainly: **a missing trailer does not mean a commit was hand-written.** It
means the marking stopped. The seven that carry it are AI-heavy for certain; the
rest are unlabelled, not human-verified. AI_COLLABORATION.md is the honest
account of where AI was used.

## Documents

| File | What is in it |
|---|---|
| [DECISIONS.md](DECISIONS.md) | The choices that mattered, and why. |
| [SCOPE.md](SCOPE.md) | What was built, what was skipped, what is assumed. |
| [AI_COLLABORATION.md](AI_COLLABORATION.md) | How I worked with AI. Written by hand. |
| [CLAUDE.md](CLAUDE.md) | Rules for keeping these documents true. |
| [e2e/README.md](e2e/README.md) | What the end-to-end suite covers. |
| [references/SRS.pdf](references/SRS.pdf) | Full requirements, numbered R-nn. |
| [references/FeedbackHub-Assignment.pdf](references/FeedbackHub-Assignment.pdf) | The original brief. |
