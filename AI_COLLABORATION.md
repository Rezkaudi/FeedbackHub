# AI COLLABORATION

How I worked with AI on this project. The brief asks six things (Section 6).
Each heading below answers one, in plain words.

---

## 1.1 Tools, and who did what

**Tool:** Claude Code (Opus / Sonnet) inside VS Code. One tool, for everything.

**The AI did:** read the brief, wrote the SRS, wrote the first draft of
`README.md`, `DECISIONS.md`, `SCOPE.md`, `CLAUDE.md`, then the backend
(NestJS + Prisma) and the frontend (Angular).

**I did:** every scope and design choice. What stays, what goes, what the brief
really means. I read every change before it was committed.

**First move:** I asked for `CLAUDE.md` before any other file. It holds the
brief's rules as short lines and loads at the start of every AI session. So a
fresh AI with no memory still follows the brief.

---

## 1.2 How I worked

**Plan first, then build against the plan.** Three big prompts, in order:
docs, then backend, then frontend. Each one starts with "read the brief, do not
guess, show me the plan and wait".

**Docs before code, on purpose.** The brief says the app is easy and AI can
build it fast. So the value is in the spec, not the code. I wrote the spec first.

**Every rule has a number** (R-1, R-2, ...). Later each number becomes a test.
Tests come from the spec, not from a guessed coverage number.

**Small steps after the big prompt.** After each prompt I worked in short
passes and checked the result.

**I check, I do not just read.** A clean answer can still be wrong. After each
pass I check the claims against the real files, not against the prose.

**Method did change:** for the backend and frontend I moved to strict TDD
(failing test, minimum code, refactor) because it kept the AI honest.

**Context I gave the model, every session:** `CLAUDE.md` (loads on its own), the
SRS with its numbered rules, and for the frontend the live OpenAPI spec as the
API contract. Not the chat history - each big step started clean, so the files
had to carry the context.

---

## 1.3 Three worked examples

The three prompts that built the project. Kept verbatim in [/Prompts](../Prompts).

### Example 1 — Study and documentation

**Prompt (trimmed):**

```
You are a senior full stack developer.
Read references/FeedbackHub-Assignment.pdf completely before you do anything.
Do NOT build the app yet. Only study and documentation.
Create exactly these files, no others:
  CLAUDE.md   - every rule from the brief, as short checkable lines
  README.md   - what/how to run/how to test/what works, with TODO placeholders
  DECISIONS.md - context, options, decision, consequences. Real trade-offs.
  SCOPE.md    - in scope, out of scope, ambiguities, assumptions, next week
  AI_COLLABORATION.md - headings only, no content
  docs/SRS    - purpose, roles, numbered requirements, data model, ERD,
                business rules, acceptance criteria
Call out the requirements most likely to be graded or to be got wrong.
Choose the simplest design that meets the brief. Do not over-engineer.
If something is risky or unclear, say so instead of guessing.
```

**What came back:** all files in one pass. The SRS was complete: numbered rules,
data model, ERD, acceptance criteria. Good work, but it designed **more app
than the brief asks for**.

**What I did:**
- Deleted a `status_history` table it invented (no rule reads it).
- Checked every table and field with one question: "which numbered rule needs
  this?" No rule -> delete. Eleven tables became nine.
- Added two missing things: rate limits on writes, and one real feature flag
  that blocks the UI **and** the server.
- Named the pagination parameters the brief leaves open.
- Kept the numbered rules unchanged. Best idea in the whole answer.

### Example 2 — Backend

**Prompt (trimmed):**

```
You are a senior backend engineer.
Read docs/SRS and the brief. List anything ambiguous instead of guessing.
Create the full repo skeleton (backend + empty frontend folders). Show the
tree and wait for my approval.
Stack: NestJS + TypeScript, PostgreSQL + Prisma, Keycloak for auth
(never implement auth primitives), OpenAPI/Swagger, Docker + k8s manifests.
Architecture: modular monolith, controller -> service -> repository,
dependencies point inward only.
Then build the backend module by module in TDD: failing test, minimum code,
refactor.
Every module: server-side authorization tested for the negative cases,
validation at the boundary, one error format, Swagger decorators, unit +
integration tests on a real Postgres.
Security: rate limiting, Helmet, CORS allowlist, no IDOR, no mass assignment,
audit log for admin actions, env-driven config, no secrets in the repo.
Simplest thing that meets the SRS. No frontend code. No E2E yet.
```

**What came back:** the skeleton, then each module with tests. Auth wired to
Keycloak. Swagger matching the code.

**What I did:**
- Approved the folder tree before any code was written.
- Made it write the negative auth tests first (wrong user, wrong role, someone
  else's resource), not the happy path.
- Removed "audit log for admin actions" - I had put it in the prompt, but the
  SRS has no such table. Raised it, then followed the SRS.
- Removed a "similar feedback requests" feature it added (needs an AI model and
  vector search, not in the brief).
- Checked the Prisma schema against the SRS field by field.
- Made the "database stops it" rules real constraints (unique index for one
  vote per person, partial unique index for one default status), and made the
  integration tests prove the *database* refuses, not just the service.

### Example 3 — Frontend

**Prompt (trimmed):**

```
You are a senior frontend engineer.
Read the SRS, the brief, and the OpenAPI spec at /api/docs. The API is the
contract. Change the backend only when a test proves it wrong.
Show me the frontend folder tree, the state choice with a reason, the routing,
and how the app boots: OIDC login, then ONE call to /bootstrap - no chain of
blocking requests. Wait for approval.
Stack: Angular latest stable, standalone components, signals; state and styling
your call with justification; Keycloak via OIDC + PKCE, never a token in
localStorage; typed client from the OpenAPI spec; unit + Playwright E2E.
Use the ui-ux-pro-max skill for the design: style direction, light+dark
palette, typography, spacing, component set, layouts. Deliver as design tokens
and Angular components, not a picture.
Build feature by feature in TDD. Every feature: all four states (loading,
empty, error, success), inline validation, keyboard reachable, AA contrast,
responsive, lazy route, OnPush. UI hides what a user cannot do but never relies
on hiding - the server is the authority.
Then Playwright E2E for the journeys in brief section 3.4.
```

**What came back:** folder tree, state choice (signals), a token-based design
system, then each feature with the four states and tests. E2E for the user and
admin journeys.

**What I did:**
- Approved the plan first.
- Held the line on one `/bootstrap` call - the first draft still made a few
  extra startup requests.
- The end-to-end run then found four real bugs the unit tests missed, and I had
  the AI fix each with a failing test first:
  - the board sort control showed "Newest first" while sorted by votes;
  - the admin status picker showed the wrong status, so an admin could change
    it by accident;
  - an admin could not delete someone else's comment (the server allowed it,
    the button was hidden);


---

## 1.4 When the AI was wrong

**A subtly broken check - the refresh cookie path.** The AI scoped the refresh
token cookie to `Path=/auth/refresh`. The app adds a global `/v1` prefix, so the
real route is `/v1/auth/refresh`. The browser never sent the cookie: refresh
always failed with 401, and sign-out silently skipped ending the Keycloak
session, so the next sign-in came back with no password asked. **Every test
passed** - the API tests stub the identity provider, so nothing caught it. I
found it only by signing out in a real browser and being let straight back in.
Fix: scope the cookie to `/v1/auth` (D-32). After this I stopped trusting any
auth flow that was only proven by stubbed tests.

**A plausible but wrong config - Keycloak's address.** The AI built the sign-in
URL by joining the issuer the server dials (`http://keycloak:8080`) with the
auth path. That host only exists inside the container network, so the browser
redirect died. Nothing logged an error - from the server's side every step
succeeded. Fix: let Keycloak publish both a browser address and a backchannel
address, and read the URL from its discovery document instead of building it

---

## 1.5 Something that worked, and I deleted it anyway

**What it was.** The AI built search the textbook way: a Postgres `tsvector`
column on every request, a trigger to keep it fresh, and a GIN index. It also
added a `last_activity_at` column in the same spirit. Search was fast and
ranked. Tests passed. A reviewer would not have flagged it.

**What was wrong with it.** It buys speed the app does not need yet - the board
is a few thousand rows - and charges for it on every write: each edit now fires
a trigger and two index updates. `last_activity_at` was worse: an extra write on
every vote and every comment, to power a "sort by last activity" nobody asked
for. Both are answers to load that does not exist.

**What I did instead.** Dropped both columns, the trigger and the index. Search
is now a plain `ILIKE` over title and description, run at read time - fewer
moving parts, nothing to keep in sync. When the board is big enough to feel it,
a trigram index goes back with no data migration. Written up in `DECISIONS.md`
(D-11) and listed in `SCOPE.md` as a known limit: no stemming, no ranking.

**Why.** The brief grades judgment on top of what AI produces. The AI reaches
for the complete solution by default. The work was to ship the smallest thing
that meets the brief and write down exactly what that costs.

---

## 1.6 How AI commits are marked

Commits that are mostly AI work carry a marker in the message. Commits without
it are written by hand.

**Where the line is.** A commit is "AI-heavy" when the AI wrote the code and I
reviewed it. A commit is hand-written when I wrote or substantially reworked it
myself - a bug fix I traced, a decision I encoded, a rename I drove. Mixed
commits are marked, because the honest default is to over-attribute the AI.

**Verified, not assumed.** I check the marker against the real commit history,
not against what I meant to do. The README must describe the convention the
commits actually follow.
