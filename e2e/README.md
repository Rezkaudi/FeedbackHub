# FeedbackHub E2E — Cypress

This directory is a complete replacement for the previous Playwright `e2e` directory.

## Scope

The suite covers the application behavior represented by the supplied project source: authentication and sign-out, protected routes, session/cookie behavior, board/search/filter/sort/pagination, request creation/edit/delete/ownership, comments and moderation, feature flags, votes, personal settings, admin settings, taxonomy, invitations, authorization, origin/CSRF enforcement, rate limits, API contracts, error handling, resilience, and critical end-to-end journeys.

Accessibility tooling and accessibility-only specs are intentionally excluded.

## Run

```bash
npm ci
npm run typecheck
npm test
```

For local interactive work:

```bash
npm run test:open
```

If your shell exports `ELECTRON_RUN_AS_NODE=1`, Cypress's bundled Electron will
not start (`bad option: --no-sandbox`). Unset it for the run:
`env -u ELECTRON_RUN_AS_NODE npm test`. On a headless machine wrap it in
`xvfb-run -a`.

## Rate limits

`cypress/support/e2e.ts` lifts the submission / vote / sign-up limits at the
start of every spec and restores the shipped defaults (10 / 100 / 20 per hour)
in an `after` hook. R-130 to R-132 are still proven — specs 05 and 10 set a
small limit of their own over a one-minute window. A run killed part-way can
leave the limits lifted; re-seeding (`docker compose up`) resets them.

## Environment

- `BASE_URL`: defaults to `http://localhost:4200`
- `KEYCLOAK_ORIGIN`: defaults to `http://localhost:8080`
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- `SAM_USERNAME`, `SAM_PASSWORD`
- `RAE_USERNAME`, `RAE_PASSWORD`

The suite expects the real FeedbackHub stack to be running. Authentication is performed against the real Keycloak login page; application session cookies are not forged.

## Cypress-specific rules used here

`cy.session()` is used for reusable authenticated personas — each of admin / sam / rae signs in once per spec file, not once per test. `cy.origin()` wraps the cross-origin Keycloak login flow; inside a `cy.session()` setup there is never a valid cookie, so the guard always bounces to Keycloak and the login block runs unconditionally (probing the origin first races the SPA's post-paint redirect). `cy.request()` is used for real API calls that must share the browser session, especially server-side authorization and feature-switch enforcement; its write helpers in `support/commands.ts` set an `Origin` header because the API's OriginGuard (R-3g) refuses a write without one and `cy.request()` sends none. `cy.intercept()` is reserved for deliberately simulated transport/error conditions, not normal business-flow setup. `testIsolation` remains enabled so state is reset between tests. After a sign-out test the browser is on the Keycloak origin, so a following assertion must use `cy.request()` (origin-independent) rather than `cy.get`/`cy.getCookies`.
