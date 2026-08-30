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
- **Arabic is in scope.** R-57 asks for it, and one test in SRS part 17 depends
  on it (a notification email written in Arabic). It means every string is
  translated and every screen is checked in RTL.
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

**Nothing was cut for time.**

Everything in section 2 left the plan because nothing reads it, not because the
week ran out. Over three revisions of the SRS, eleven tables became nine. Six
groups of fields were removed. Three things were added: the comments feature
flag, the six rate-limit fields with R-130 to R-132, and R-66, which says only an
admin manages invitations.

`references/SRS.pdf` is edited in place. It is 38 pages. Each revision has an
addendum at the end listing every change.

**We never renumber a rule.** R-50 is an empty number for ever. Renumbering would
move every rule from R-51 to R-118, and every pointer to them.

---

## 7. Still to decide

Nothing about the stack. One small thing is still open:

- Which fields the OpenAPI document shows.

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

**Docker Compose v2 is required.** `docker-compose.yml` uses the Compose Spec —
no `version:` key, and `depends_on` with `condition: service_completed_successfully`,
which is what makes the migration finish before the API starts (R-82). Compose
v1.29 cannot parse it and fails on the `name:` key. The file was deliberately not
downgraded, because the old syntax cannot express "wait until the migration job
succeeded", and R-82 is the reason the step exists. The machine this was built on
has v1.29, so the same wiring was verified by starting the containers by hand
instead: the migration image was run twice against a real Postgres and left
identical row counts, and only then was the API started.
