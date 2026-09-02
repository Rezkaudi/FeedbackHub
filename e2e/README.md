# FeedbackHub E2E — Cypress

A full rewrite of the suite, organised by domain, driven by `data-testid`
selectors rather than English text or CSS classes — the app is translated
(English/Arabic), and a locale change must never break a test.

## Layout

```
cypress/
├── e2e/
│   ├── 00-smoke/        Stack is up, seeded, one origin — fails fast and loud.
│   ├── 01-auth/         Sign in/out/up, invitations, reset password, session
│   │                    lifecycle, re-sign-up, guards, the Google-IdP gap.
│   ├── 02-board/        Listing, search/filter/sort, paging, error states.
│   ├── 03-requests/     Create/edit/delete/pin/status/votes, the list contract.
│   ├── 04-comments/     Write/read, edit/delete, moderation, comments-off.
│   ├── 05-profile/      Profile, personal preferences, delete-my-account.
│   ├── 06-admin/        Categories, statuses, settings, registration policy,
│   │                    invitations, admin route/API access.
│   ├── 07-cross-role/   Admin change -> user sees it; author/admin/stranger;
│   │                    admin acting on their own content; admin vs admin;
│   │                    notification emails.
│   ├── 08-hardening/    Permission matrix, Origin guard, validation/ids,
│   │                    rate limits, error envelope, resilience.
│   └── 09-experience/   i18n/RTL, navigation.
└── support/
    ├── e2e.ts            Global hooks: rate-limit lift/restore, cleanup drain.
    ├── commands/         cy.signIn, cy.byTestId, cy.mailWaitFor, …
    ├── clients/          Typed wrappers: api.client, keycloak-admin.client,
    │                     mailpit.client.
    ├── flows/            cy.origin-safe Keycloak page-driving callbacks.
    ├── fixtures/         accounts, seed-ids, and the with*() setup/teardown
    │                     helpers (app-settings, taxonomy, ephemeral-user, realm,
    │                     entities).
    └── utils/            testids.ts (the one place every data-testid string is
                          written), stamp.ts, types.ts.
```

Numbering is execution order (Cypress runs specs in lexical path order): cheap
read-only checks first, specs that only touch their own data next, specs that
mutate global singletons (taxonomy, app settings, the realm) last.

## Run

```bash
npm ci
npm run typecheck
npm test
```

Per-domain: `npm run test:auth`, `test:board`, `test:requests`, `test:comments`,
`test:profile`, `test:admin`, `test:cross-role`, `test:hardening`,
`test:experience`, `test:smoke`.

Interactive: `npm run test:open`.

If your shell exports `ELECTRON_RUN_AS_NODE=1`, Cypress's bundled Electron will
not start (`bad option: --no-sandbox`). Unset it for the run:
`env -u ELECTRON_RUN_AS_NODE npm test`. On a headless machine, use
`npm run test:local`, which wraps that in `xvfb-run -a`.

The suite expects the real stack running (`docker compose up --build -d --wait`
from the repo root, or the podman-compose equivalent). Authentication goes
through the real Keycloak login page; no session cookie is ever forged.

## Selector strategy

Every interactive element the suite touches carries a `data-testid`, listed
in `support/utils/testids.ts` — nowhere else hardcodes one. Repeated elements
(request cards, comments, taxonomy rows, invitation rows, pending comments)
also carry a keyed attribute (`data-request-id`, `data-comment-id`,
`data-category-id`, `data-status-id`, `data-invitation-id`) so a spec can
address exactly the row it created, independent of order, paging, or
translated text — use `cy.byTestId(id)` or `cy.byTestIdFor(id, {request: id})`.
A handful of ARIA landmarks that happen to be hard-coded English
(`nav[aria-label="Pages"]`, etc.) are avoided on purpose in favour of testids,
so a locale change can never silently break a selector.

## Test data hygiene

The seed (`apps/api/prisma/seed/seed.ts`) only ever upserts — it never
deletes — so the database persists and accumulates across runs. The rule:

- **Seeded requests/comments/taxonomy/the one seeded invitation are read-mostly.**
  Specs may read them and may vote on a seeded request (reversible); anything
  needing an edit, delete, pin, or status change creates its own request via
  `support/fixtures/entities.fixture.ts` (`makeRequest`, `makeComment`,
  `makeCategory`, `makeStatus`, `makeInvitation`).
- **Everything `make*()` creates is tracked and cleaned automatically.** A
  global `afterEach` (`support/e2e.ts`) drains the registry after every test,
  signing in as `ADMIN` first (whoever a test ends signed in as may not be
  allowed to delete what it made — an admin always can). The registry itself
  lives on `Cypress.env()`, not a module-level variable — Cypress bundles the
  support file and each spec file separately, so a plain `let registry = []`
  at module scope becomes two independent arrays that never see each other's
  writes, and cleanup silently drains nothing. `Cypress` itself is the one
  true singleton both bundles share.
- **Settings, taxonomy, and the realm are restored, never left dirty.** Use
  `withAppSettings`/`useAppSettings`, `withTaxonomy`, or `withRealmSettings`
  from `support/fixtures/` for any spec that changes them — each snapshots the
  original state and restores it in an `after` that runs even on failure.
  Nothing outside those helpers calls `PATCH /v1/settings/app` directly.
  `withTaxonomy` restores the *original default status first*, before it
  deletes anything created during the spec — a spec proving "a new request
  lands on the current default status" necessarily leaves its new status
  `isDefault: true`, and deleting a status while it is still the default is
  refused with 409 (R-48); restoring the default first is what makes it
  deletable again. Getting this order backwards was a real bug the "run the
  full suite twice back to back" check in the plan's own verification step
  caught — the first run was 359/359 green, the second run then failed with
  a polluted taxonomy count, because two orphan statuses from that exact
  scenario had silently failed to delete.
- **Ephemeral Keycloak users** (sign-up, reset-password, verify-email,
  delete-account specs) go through `withEphemeralUser`, which creates a
  throwaway Keycloak account and deletes it afterward. Their app-side row (if
  implicit registration ever created one) is left behind as an idle,
  never-signed-into-again row — harmless, since no spec asserts on the full
  list of registered people.
- **Mailpit is scoped, never purged in bulk.** Assertions search
  `to:<address>`; only `withEphemeralUser` teardown deletes mail, and only for
  its own address. `npm run mail:purge` exists for a human clearing a dev box.
- **The four seeded personas — Ada, Bo, Sam, Rae — are never deleted, renamed,
  or re-roled** by any spec (Bo is used as a second admin for admin-vs-admin
  cases and briefly to prove the last-admin invariant, but is always restored).
  `05-01-profile.cy.ts` restores Sam's display name because other specs assert
  on "Sam Sample". Restoring Bo's role after the last-admin case needs one
  exception to "everything goes through the real API": `DELETE /v1/me` wipes
  `externalId`/email, and re-registering that Keycloak identity always creates
  a plain `role: 'user'` row — there is no product route to promote one to
  admin, only the seed script sets it. `cypress.config.ts` opens a direct
  Postgres pool (`pg`) and exposes one Cypress `task`, `dbSetUserRole`, used
  from nowhere but that one test, to put Bo's role back by `externalId`. It is
  test infrastructure standing in for a missing product capability, not a way
  to assert on product behaviour — everything the suite actually *proves*
  still goes through the real HTTP API or Keycloak's Admin API.

## Cypress-specific rules used here

- `cy.session()` caches each persona's login across specs; `validate()`
  requires a live `GET /v1/bootstrap` → 200, so a revoked or stale session is
  re-driven rather than silently reused.
- `cy.origin()` wraps every cross-origin Keycloak page interaction
  (`support/flows/keycloak-browser.flows.ts`). Its callbacks are serialised
  with `Function.prototype.toString()` and must be top-level arrow functions
  with a single `args` parameter and zero free variables — no imports, no
  closures, no `async`/`await`. Selectors inside them are structural
  (`#username`, `#kc-login`, `#kc-register`, …), confirmed against the live
  Keycloak 26 theme this stack renders.
- `cy.request()` is used for real API calls sharing the browser session,
  especially server-side authorization and feature-switch checks. Its write
  helpers (`support/clients/api.client.ts`) set an `Origin` header, because
  the API's OriginGuard refuses a write without one and `cy.request()` sends
  none — a bare `cy.request('/v1/auth/sign-out')` string shorthand is a GET,
  which that route does not serve, so `cy.signOutApi()` exists specifically to
  avoid that footgun.
- `cy.intercept()` is reserved for deliberately simulated transport/error
  conditions (`08-05`, `02-04`), never for normal business-flow setup — real
  requests hit the real stack everywhere else.
- `testIsolation: true` stays on — it clears cookies/localStorage/sessionStorage
  between tests, but not server state, which is why the hygiene rules above
  exist.
- After a sign-out (or a deep link while signed out), the browser ends up on
  the Keycloak origin; any assertion right after must use `cy.request()`
  (origin-independent) rather than an app-window command like `cy.getCookie`.

## Rate limits

`support/e2e.ts` lifts the submission/vote/signup limits (100,000 over a
1-minute window — the DTO's ceiling) at the start of the run and restores the
shipped defaults (10/100/20 per hour) at the end. `08-04-rate-limits.cy.ts`
sets its own small limits inside `withAppSettings` to prove the limits are
real, and restores the *lifted* values afterward so the rest of the run stays
unaffected. A run killed mid-way can leave small limits behind; re-seeding
(`docker compose up`) does not fix this — re-run the suite once, or
`PATCH /v1/settings/app` back to the lifted values by hand.

## Parallelism constraint

Only shard across processes that each own a separate stack. On one shared
stack, `04-comments`, `06-admin`, `07-cross-role`, `08-hardening`, and the
policy/limit/realm-mutating specs in `01-auth` (`01-04`, `01-05`, `01-07`,
`01-09`) must run in the same shard, serially — they mutate settings/taxonomy/
the realm that every other spec's assumptions depend on.

## Environment variables

| Variable | Default |
|---|---|
| `BASE_URL` | `http://localhost:4200` |
| `KEYCLOAK_ORIGIN` | `http://localhost:8080` |
| `MAILPIT_ORIGIN` | `http://localhost:8025` |
| `API_ORIGIN` | `http://localhost:3000` |
| `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` | `admin` / `admin` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `admin@feedbackhub.local` / `password` |
| `ADMIN2_USERNAME`, `ADMIN2_PASSWORD` | `bo@feedbackhub.local` / `password` |
| `SAM_USERNAME`, `SAM_PASSWORD` | `sam@feedbackhub.local` / `password` |
| `RAE_USERNAME`, `RAE_PASSWORD` | `rae@feedbackhub.local` / `password` |

## Known gaps

See SCOPE.md for the full table. In short: a real Google sign-in cannot run
locally (the realm's Google identity provider has empty credentials on
purpose — no real secret is committed); `01-08-google-idp.cy.ts` proves the
button exists and fails safely instead. Comment editing has no UI
(`PATCH /v1/comments/:id` is proven at the API level only). A second admin
(Bo) is seeded so admin-vs-admin and last-admin cases are provable, but there
is still no route to promote a user to admin at runtime.
