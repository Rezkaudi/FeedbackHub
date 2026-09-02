# SCOPE

What was built, what was left out on purpose, what was unclear, what is assumed,
and what comes next. Reasons for the technical choices are in
[DECISIONS.md](DECISIONS.md); the honest state of each feature is in
[README.md](README.md).

---

## 1. What was built

**The product**

- Feedback requests: title, description, category, status, author, vote count,
  comment count, pinned, timestamps. Create, read, edit, delete.
- A board: sort, filter by status and category, text search, paging, "my
  requests", pinned first.
- Votes: one per person per request, withdrawable, enforced by the database.
- Comments: flat, newest first, cursor paging, edit and delete by the author,
  optional admin approval, and a feature flag that switches them off.
- Two roles. A user manages their own content and settings. An admin also
  triages, moderates and configures the app.
- Taxonomy: admins add, edit, retire and delete categories and statuses.
- Settings, split in two: app-wide (registration policy, comment approval,
  three rate limits, one feature flag) and per user (name, avatar, theme,
  language, default sort and filters, email preferences, delete account).
- Email on new comments and on status changes, plus invitations.
- English and Arabic, with RTL.

**The system**

- One API (modular monolith, 9 modules) plus one email worker on the same image.
- PostgreSQL + Prisma; Redis for rate limits and the email queue.
- Keycloak for sign-in — no auth primitive is written here.
- Docker images, one-command Compose stack with seed data, Kubernetes manifests
  for the app tier, and CI running every test layer.
- Tests in four layers: unit, integration on real Postgres and Redis, API
  through the whole guard chain, and Cypress end to end on the real stack.

---

## 2. What was deliberately not built

| Not built | Why |
|---|---|
| "Similar requests" suggestions when submitting | The feature that would serve the product's goal most directly, and the one we could not do honestly at this size. See below. |
| A `notifications` table and a bell in the UI | Notifications leave as email and are never stored, so there is nothing to show in the app. See below. |
| A split into several services | The app is small. One deployable with enforced internal seams gives the same boundaries and far less operational cost (D-18). |
| Server-side rendering | An internal, signed-in tool. Nothing to index, and SSR would add a second runtime (D-37). |
| NgRx or a similar store | Signals plus small feature stores cover this size (D-38). |
| An audit log of admin actions | Real work — a table, a writer, a screen, a retention rule. Not in the brief (D-12). |
| Comment threading | The brief says comments on a request, not conversations (D-05). |
| Ranked search | `ILIKE` is enough at this size; ranking needs a trigram index and tuning (D-11). |
| A status-history table | "History" in the brief always means Git history (D-08). |
| A maximum page size | Removed to keep the contract small. It should come back (D-04). |
| Rate limits on comments and invitations | Three limits were asked for; two more can be added the same way (D-15). |
| Email preferences as a table | Two booleans are enough for two events (D-07). |

**Why "similar requests" was dropped.** The product exists to stop the same idea
arriving five times, so the obvious feature is: while someone types a new
request, show the ones already on the board that mean the same thing.

Done properly, that is semantic matching — an embedding model over every title
and description, a vector column (`pgvector`) or a separate vector store, a
re-embedding job whenever text is edited, a similarity threshold somebody has to
tune, and a cost and latency budget for the model calls. That is a second system
with its own failure modes, sitting on the write path of the main one.

Done cheaply, it is word matching — `ILIKE` or trigram similarity. That finds
"dark mode" next to "dark mode" and misses "night theme", which is exactly the
duplicate a person could not have found by searching. A duplicate-finder that
only catches what you would have caught anyway is worse than none: people learn
to trust it, and then it stays quiet at the moment it matters.

So it is not built. The board leans on plain search, categories and pinning
instead. If it were built, the smallest honest version is `pgvector` with one
embedding call on write, shown as **suggestions only** — never blocking a
submission, because a wrong "this already exists" silences a real request.

**Why there is no in-app notification centre.** A notification here is an email
and nothing more. The three events — a comment on my request, a status change on
my request, an invitation — become a job in a Redis list, the worker renders the
message and sends it, and then the job is gone. A failure is logged and dropped:
no retry, no record.

So there is no `notifications` table, and no bell with a red dot. Building one
is not a small addition to what exists — it is a different shape:

- a table of one row per person per event, with a read/unread flag and a
  retention rule, written in the same transaction as the thing that caused it;
- a way for the browser to learn about a new row — polling on a timer, or the
  realtime channel this app does not have;
- an unread count that survives a reload, a list, a "mark all read", and a
  decision for every event about whether it is worth interrupting someone.

The email path already answers "tell me when something happens to my request",
which is what the brief asks for, and a person controls it with the two
preferences in their profile. A notification centre would answer it *better*
inside the app, and it would also be the third place the same event has to be
kept correct. It was not worth that in this scope.

If it were built: one `notifications` table written next to the event, the
unread count added to `/v1/bootstrap` so the bell is right on first paint, and
polling before websockets — the count is not worth a socket.

---

## 3. What was unclear, and how we read it

**Which side does the language belong to — the back end, or only the front end?**
The brief asks for a language setting but never says how far it reaches. An API
can answer in the person's language, or it can answer in one language and let
the screen translate. We read it as: **the front end owns the words a person
reads; the API answers in English.**

What that means in practice:

- **The UI is fully translated.** Every string is a key in two typed
  dictionaries (`en.ts`, `ar.ts`), Arabic is type-checked against English's key
  shape, and `dir` and `lang` flip before the first paint.
- **The API answers in English.** Every error carries a machine code
  (`FORBIDDEN`, `RATE_LIMITED`, …) plus an English sentence. The front end maps
  the code to a translated string; the English sentence is a fallback and a log
  line, not something a person is meant to read.
- **Email is the exception, and it is translated on the server.** An email is
  written at the moment the event happens — possibly while the person is signed
  out and no browser is involved — so the server has to know their language.
  That is why `language` lives in `user_settings` and not only in the browser.
- **One known leak:** `CONFLICT` is a single code covering several different
  refusals ("that address is already invited", "this category is in use, retire
  it instead"), so the server's English sentence is shown as-is. Those few
  admin-only messages stay English until the API grows finer codes (D-91).

**"At least one feature flag that visibly changes behavior."**
Read as: one real flag, wired all the way through — comments on or off, visible
to every user at once, and enforced by the API and not just hidden in the UI
(D-09).

---

## 4. Assumptions

- The front end and the API share a domain. `SameSite` depends on it.
- Keycloak issues a new refresh token on every use.
- No request that changes data is ever a GET.
- The email and name copied from Keycloak may go out of date.
- Theme, sort and filters are per device on purpose; language is per account,
  because email is written while the person is signed out.
- Two languages are enough to prove translation works.
- Two email events are enough; a third is one more column.
- Nobody asks for a page big enough to hurt the server. Nothing stops them.
- A few thousand requests keep `ILIKE` fast enough. Past that, D-11 is undone.
- The rate-limit numbers (20 / 10 / 100 per hour) are guesses. That is why they
  are settings, not constants.
- One shared sign-up limit is acceptable: before an account exists there is no
  person to count against.

---

## 5. What is unfinished

Two things are built but have never been run against the real service they will
meet in production, and one needs a credential before it works.

- **No real SMTP server has been contacted.** Comment, status-change and
  invitation emails have all been watched landing in Mailpit, so the queue, the
  worker, the wording and the last local hop are proven. TLS and a login
  (`SMTP_USER` / `SMTP_PASSWORD`) are wired but have never run against a real
  provider.
- **The Kubernetes manifests have never been applied.** `kustomize build`
  renders and every object passes `kubeconform -strict` for 1.31, but no cluster
  was brought up. They cover the app tier only — no Postgres, Redis, Keycloak,
  Mailpit, web app or Ingress.
- **Google sign-in works, but only with credentials.**
  `infra/keycloak/realm/feedbackhub-realm.json` ships with `clientId` and
  `clientSecret` empty, because real credentials cannot be committed. Fill them
  in — README.md says how — and it signs in; it was checked by hand. On a fresh
  clone the button renders and fails on Keycloak's side. No automated test
  covers a real social login: `01-08-google-idp.cy.ts` only proves the button
  fails safely.

Limits that are **choices, not gaps** — no audit log, no maximum page size, no
comment threading, no similar-request suggestions, no in-app notifications,
search without ranking — are in §2 above, with the reason for each.

---

## 6. What we would do next, with another week

1. Prove a real SMTP provider end to end, with TLS and a login.
2. Run the Kubernetes path on `kind`, and add Ingress, the web app and the data
   tier.
3. Add an automated test for Google sign-in against a test client.
4. Bring back a maximum page size (D-04).
5. Add rate limits on comments and invitations (D-15).
6. Add an audit log of admin actions (D-12).
7. Prototype "similar requests" with `pgvector` — embeddings on write,
   suggestions only, measured against real duplicates before trusting it (§2).
8. Add a `notifications` table and an in-app bell, if people ask for one — the
   unread count on `/v1/bootstrap`, polling before websockets (§2).

---

## 7. What changed while building

- The presentation layer was rebuilt on Material Design 3 mid-project, on
  request. The Cypress suite was then rewritten from scratch against it, moving
  from Playwright to Cypress (D-48, D-100).
- Arabic and RTL were first cut, then built.
- The data model went from eleven tables to nine over three revisions of the
  SRS. Rules are never renumbered, so some numbers are permanently empty.
- Editing a request became a popup, and the `/requests/:id/edit` route was
  removed (D-76).
