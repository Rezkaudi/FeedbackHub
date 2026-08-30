# SCOPE

This file answers four questions:

1. What are we building?
2. What are we not building?
3. What was unclear in the brief, and how did we read it?
4. What comes next?

**The backend is built. The front end is empty folders.** Section 8 lists what
changed while building. [README.md](README.md) says what works today.

`D-nn` points to [DECISIONS.md](DECISIONS.md). `R-nn` points to `references/SRS.pdf`.

---

## 1. What we are building

### The app

A feedback board for people inside one company.

**Anyone signed in can:**
- Write a request. Give it a title, a description and a category.
- See the board. Sort it, filter it by status and category, search it, page through it.
- Open a request and read the comments.
- Upvote a request. Take the vote back. One vote per person per request.
- Write a comment. Edit their own. Delete their own.
- Edit their own request. Delete their own request.
- Change their own profile and settings.

**An admin can also:**
- Change the status of a request.
- Pin a request to the top of the board.
- Add and remove categories and statuses.
- Delete a comment.
- Change app-wide settings, including one feature flag.
- Send and cancel invitations.

### The stack

| Part | What we use |
|---|---|
| Front end | Angular 20, signals, Tailwind |
| Back end | Node.js 22, NestJS 11 |
| Database | PostgreSQL 16, Prisma |
| Cache and counters | Redis 7 |
| Sign-in | Keycloak |
| Email | SMTP, with a local mail catcher |
| Running it | Docker Compose, plus Kubernetes files for a local cluster |

Why each one: D-16 to D-21.

### How the code is shaped

One app, not many services. Inside it, eight modules with real walls between
them: `identity`, `requests`, `votes`, `comments`, `taxonomy`, `settings`,
`invitations`, `notifications`. Email runs in its own process. A CI check fails
the build if one module reaches into another (D-18).

### Sign-in

Keycloak owns sign-in. Our server talks to it and puts both tokens in cookies
the browser cannot read. **The browser never holds a token** (D-01).

Our database keeps a small copy of each user: our id, the Keycloak id, the email,
the name, and a flag for admin.

### Comments

One flat list. Newest at the top. No replies inside replies.

The list is read with a cursor, not page numbers, so nothing is shown twice and
nothing is skipped while people are writing (D-05).

The comment count is different for different people. A comment waiting for
approval is counted only for the person who wrote it, and for admins (R-40).

### Where settings live

| Setting | Where it lives | Why |
|---|---|---|
| Theme, default sort, default filters | The browser | The server never needs them (D-06) |
| Language | The server, with a copy in the browser | So the app can draw before the first call finishes (D-06) |
| Two email preferences | The database, two true/false columns | Two options do not need a table (D-07) |
| Categories, statuses, limits, the feature flag | The database, `app_settings` | Admins change them while the app runs (D-09, D-15) |

### Rate limits

| What | How many | Counted for |
|---|---|---|
| New accounts | 20 per hour | The whole app |
| New requests | 10 per hour | Each person |
| Votes | 100 per hour | Each person |

The clock slides. It does not reset on the hour. When we say no, we say when to
try again. An admin can change all three numbers without a deploy (D-15).

R-131 also says deleting a request must not free its slot. That one part is not
built — see section 8 for why, and what is open because of it.

### Tests

Test first, then code. Four layers, plus Playwright for the whole system with a
real Keycloak sign-in (D-22).

The end-to-end suite covers all eleven journeys of SRS part 6 — U-1 to U-6 and
A-1 to A-5 — plus the two hard parts, H-4 (one call at start-up) and H-5 (the
comments switch that also stops the server), plus an axe pass on the board, the
request page and the settings screen (R-163). It lives in `e2e/`, in a package
of its own (D-42), signs in through the real form every time (D-43), and lifts
the submission rate limit for the length of the run (D-44).

Two things it decided for itself, and both are worth naming because they cost
something:

- **Some tests go straight to a request's address rather than clicking it on the
  board.** Every run files requests of its own, so on a database that has been
  used a few times the seeded ones are no longer on the first page. A test about
  voting that fails on pagination proves nothing. One test in U-3 still opens a
  request by clicking it, so the journey itself is not lost.
- **Two tests assert on `fh-taxonomy-chip` by element name.** Everywhere else
  the suite queries by role, label or visible text. These two cannot: the status
  name they are checking is also sitting in the admin picker's own options, so a
  plain text match would pass whether the status changed or not.

---

## 2. What we are not building

We are not hiding these. Each one is a choice.

| We are not building | Why not |
|---|---|
| Sign-in, sign-up and password-reset screens | Keycloak has them. We never see a password. |
| A way to log someone out from the server | Follows from keeping tokens in cookies (D-01). |
| A CSRF token | `SameSite` and an `Origin` check are enough while the site and the API share one domain (D-02). |
| A limit on page size | The brief does not ask for one. A very large request is now possible (D-04). |
| Replies to comments | The brief never says thread, reply or nested. The list is flat (D-05). |
| Sorting comments by "most relevant" | That needs a score we do not have. |
| An "edited" mark on a comment | The brief does not ask. `updated_at` still records the edit, so it can be added later. |
| A record of status changes | The brief never asks. In the brief, "history" always means Git history (D-08). |
| A "hide closed requests" button | Done requests stay on the board (D-10). |
| A full-text search index | Search still works with `ILIKE`. There is no word stemming and no ranking (D-11). |
| A "last activity" sort | We do not record when something last happened on a request (D-11). |
| A record of which admin moderated what | The brief does not ask for an audit log (D-12). |
| A record of who sent an invitation | Emails still match, except after an account is deleted (D-13). |
| Drag-to-reorder for categories and statuses | Both lists read in the order they were created (D-14). |
| A rate limit on comments | The brief does not ask. A loop of long comments is free (D-15). |
| A rate limit on invitations | Only an admin can invite, so the risk is smaller — not zero (D-15). |
| A table for email preferences | Two options do not pay for a table and a join (D-07). |
| "Similar requests" while you type | Doing it correctly needs an AI model and vector search. A whole extra system. The brief never asks for it. |

---

### Front end, decided during Step 1

- **Angular 22, not the 20 the SRS named.** The brief asks us to justify the
  version, and 22 is the current stable line. See D-36. It needs Node
  `^22.22.3` and TypeScript 6, which is stricter than what the machine had.
- **No server-side rendering.** Every route is behind a sign-in, so there is no
  anonymous first paint to speed up and no crawler to serve. See D-37.
- **Arabic was in scope, and was cut.** R-57 asks for it, and one test in SRS
  part 17 depends on it (a notification email written in Arabic). It was planned
  as in scope during Step 1 and dropped during Step 2. What it needs, and what
  was built anyway, is in section 6.
- **No "only my requests" filter.** Journey U-5 says a person finds their own
  earlier request, but the board rules R-16 to R-25 never list a mine filter and
  the API has no such parameter. Requests now carry `isMine`, so a person can
  recognise their own on the board, but cannot filter the whole board down to
  them. If that turns out to matter, it is one query parameter and one checkbox.
- **Server validation messages stay English.** The error shape (R-76) promises a
  code the front end translates, and it keeps that promise everywhere except
  `fields`, which the exception filter fills from class-validator's own English
  sentences. Rather than reshape the backend, the front end validates the same
  documented limits itself and shows its own translated message; the server's
  field errors are the safety net and would only be seen if the two ever
  disagreed. This is a known gap, not a solved problem.

## 3. What was unclear, and how we read it

**The brief says: keep the token in memory, not in browser storage.**
We read this as: no token anywhere JavaScript can reach. What we do is stronger —
the browser holds no token at all (D-01).
If the reviewer meant the exact words, the fix is small: keep the tokens on the
server and put only a session id in the cookie.

**The brief says a service split is preferred.**
It also says a good argument for simplicity scores better than a split with no
reason. We took that at its word and built one app with real internal walls (D-18).

**The brief never names the paging parameters.**
So the front end and the back end had nothing to agree on. We named them `page`
and `pageSize` (D-04).

**The brief says "history".**
Every time, it means Git commit history — not a log of status changes. That is
why we removed the status-history table we had invented (D-08).

---

## 4. What we assume

- The front end and the API sit on the same domain. `SameSite` needs this.
- Keycloak can give a new refresh token on every use.
- No request that changes data is ever a GET.
- The email and name we copy from Keycloak can go out of date.
- Theme, sort and filters are per device on purpose. They do not follow a person
  to another browser or another computer.
- Two languages are enough to show that translation works (SRS Q-18).
- Two email events are enough for now. A third one is one more column.
- Nobody asks for a page big enough to hurt the server. Nothing stops them.
- A few thousand requests are few enough that `ILIKE` stays under the 300 ms in
  R-103. Past that, D-11 has to be undone.
- The numbers 20, 10 and 100 are guesses. That is why they are settings.
- One shared sign-up limit is acceptable. A script can use it all up and a real
  new colleague is told to wait. While an account is being created there is no
  person to count against.

---

## 5. What we would do next, with one more week

1. Put a maximum page size back (D-04).
2. Add rate limits on comments and on invitations (D-15).
3. Keep the tokens on the server, so a session can be ended (D-01).
4. Add a trigram index and bring search ranking back (D-11).
5. Add a proper audit log of admin actions (D-12).
6. Move email preferences to a table, if a third event or Slack appears (D-07).
7. Add a CSRF token, if the site and the API ever move to different domains (D-02).

---

## 6. What was cut, and why

**One thing was cut: Arabic and RTL (R-57).**

The UI is English only. No string is translated and no screen has been checked
right-to-left.

What was built, and is real: the language choice saves to the server and comes
back on the one start-up call, `dir` and `lang` are set on the document before
the first paint so a translated build would not flash, and IBM Plex Sans Arabic
is loaded and paired with the Latin face (D-41).

What is missing is the translation itself: a message file, every visible string
moved into it, and a pass over every screen in RTL — logical CSS properties
instead of left/right, mirrored icons, and the vote and comment counts checked
with Arabic-Indic digits.

**Why it was cut.** It is wide rather than deep. It touches every template in
the app, and it cannot be done half way and still be honest: a screen that is
nine-tenths translated is worse than one that is plainly English. Against that,
the rest of Step 2 and the whole of Step 3 are the parts the brief actually
grades. The judgement was that eleven working E2E journeys prove more than a
second language on a board whose accessibility, error handling and authorisation
had not yet been proven end to end.

**What it costs.** This is the largest single gap against the SRS. The SRS part
17 test that expects a notification email in Arabic cannot pass. R-57 is not
met. The backend does its half — it stores the language and the worker reads it
— so the gap is entirely in the front end. It is also written in `README.md`
under what does not work, so it is not visible only here.

**Everything else in section 2 left the plan because nothing reads it, not
because the week ran out.** Over three revisions of the SRS, eleven tables became nine. Six
groups of fields were removed. Three things were added: the comments feature
flag, the six rate-limit fields with R-130 to R-132, and R-66, which says only an
admin manages invitations.

`references/SRS.pdf` is edited in place. It is 38 pages. Each revision has an
addendum at the end listing every change.

**We never renumber a rule.** R-50 is an empty number for ever. Renumbering would
move every rule from R-51 to R-118, and every pointer to them.

---

## 7. Still to decide

Nothing about the stack. The OpenAPI document is generated from the route
decorators and response DTOs, and the frontend type check fails if it drifts.
The taxonomy admin list includes `usageCount`, because the admin screen needs to
show which rows are safe to delete and which must be retired.

**Settled while building:** how the Keycloak realm export is kept in step with
the seed data. The three test accounts have their user ids pinned in the realm
export, and the seed writes those same ids into `users.external_id`. See D-26,
including what that coupling costs.

The Angular folder layout is now settled — the folders exist, empty, under
`apps/web/src/app`: `core/`, `shared/ui/`, `layout/`, and one folder per feature
with `admin/` nested inside it.

---

## 8. What changed while building

Kept here so the plan and the code do not drift apart.

**Two rules were asked for that the SRS does not contain, and were not built.**
The instruction to build the backend included "audit log for admin actions" and
payload/pagination limits. An audit log is refused by D-12 and appears nowhere in
the SRS, and a maximum page size was deliberately dropped by D-04. Both were
raised rather than quietly added or quietly skipped, and the decision was to
follow the SRS: no new tables, nothing the SRS does not ask for. Admin actions
are still visible in the ordinary structured request log (R-119), which is not
the same thing as an audit trail and is not claimed to be.

**A ninth module was added: `bootstrap`.** R-140 names eight. The one start-up
call of R-52 composes data owned by `identity`, `settings` and `taxonomy`, so
putting it in any one of them would break R-141. `bootstrap` owns no table and
holds no rule; it only calls the other modules' published services.

**The container runtime needed work.** The machine this was built on runs podman,
where Testcontainers does not start at all without help. See D-23. The cost is
that Testcontainers' own cleanup is switched off, so a killed test run can leave
a container behind; `npm run test:clean` removes them.

**Length and state rules are written twice** — once in a DTO for the message,
once in the database so the rule really holds. See D-24 for why, and for what it
costs.

**One part of R-131 is not built: a deleted request stops counting.** R-131 says
a request that was deleted should still count towards the submission limit while
it is inside the window, so that writing and deleting in a loop cannot walk
around the limit. Deleting a request removes its row (R-14), and the nine tables
of SRS part 12 hold nothing else that remembers it, so with no new table there is
nothing left to count. Everything else in R-130 to R-132 is built and tested: the
window is real, the count and the write happen in one database step, and the
refusal names one window after the person's *oldest* attempt. Only that one
write-delete-write loop is open. Closing it needs a row that outlives the
request — a tombstone, or an attempts table — which is a new table, and the
instruction for this step was to build the SRS tables and no others. The gap is
also written in the repository code that implements the limit, so it cannot be
found only here.

**The end-to-end suite found three real defects, and they are fixed.** They are
worth naming because none of the other four test layers could have found them,
and none of them was a typo:

1. **The board's sort control lied.** It showed "Newest first" while the board
   was sorted by most votes. A `<select [value]>` whose options come from an
   `@for` is given its value before the options exist, so the browser falls back
   to the first one. See D-45.
2. **The admin's status picker lied in the same way**, and worse: it showed
   "New" on a request that was Done, so an admin changing something else on that
   page would have moved the status without meaning to.
3. **An admin could not delete somebody else's comment.** R-37 allows it and the
   server always did; the button was only offered on your own comment, so
   journey A-3 could not be completed through the interface at all.

All three now have a component test that fails without the fix (R-161).

**One half of R-64 is still not built.** The rule says a status can be changed
"from the board and from the request page". Only the request page has it. A-2 is
covered end to end through the request page, so the journey works; the board
half does not exist and is written up in `README.md` as well.

**Sign-out was broken in two ways at once, and both are fixed.** It was the
area named here as having no test at any layer, and it turned out to be broken
in the shipped app:

1. **The button showed the person a raw JSON 404.** It navigated the browser to
   `/v1/auth/sign-out`, which is a GET; the route is a POST. Nothing ran, so the
   cookies were never cleared either — signed in, on a page saying "Not found".
2. **Even once that was fixed, sign-out did not sign anybody out.** Our cookies
   were cleared, the guard redirected to the provider, and the provider's own
   session was still alive, so it answered silently with a fresh code and the
   person landed back on the board. R-9 says sign-out "ends the session at the
   identity provider too", and it never did — `revoke` retires one refresh
   token, it does not end a session. See D-46 and D-47.

The second one is the one worth remembering: the first four assertions of the
new `sign-out.spec.ts` all passed while it was broken. Only asking for the
password screen caught it.

**Session refresh still has no test at any layer.** The access cookie outlives a
three-minute run, so nothing in the end-to-end suite ever makes the browser
renew a session, and every API test replaces the identity provider with a stub.
D-32 was a bug in exactly this area and survived a green pipeline; it would
survive one again.

**The submission rate limit had no test of its enforcement** until the
end-to-end suite grew one. The refusal *shape* was unit tested and the window
arithmetic was reasoned about, but nothing anywhere watched the server say no to
the eleventh request. `rate-limits.spec.ts` does (D-44).

**Docker Compose v2 is required.** `docker-compose.yml` uses the Compose Spec —
no `version:` key, and `depends_on` with `condition: service_completed_successfully`,
which is what makes the migration finish before the API starts (R-82). Compose
v1.29 cannot parse it and fails on the `name:` key. The file was deliberately not
downgraded, because the old syntax cannot express "wait until the migration job
succeeded", and R-82 is the reason the step exists. The machine this was built on
has v1.29, so the same wiring was verified by starting the containers by hand
instead: the migration image was run twice against a real Postgres and left
identical row counts, and only then was the API started.
