# SCOPE

This file answers four questions:

1. What are we building?
2. What are we not building?
3. What was unclear in the brief, and how did we read it?
4. What comes next?

**Nothing is built yet.** This is the plan.

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
try again. Deleting a request does not free its slot. An admin can change all
three numbers without a deploy (D-15).

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

Nothing about the stack. Three small things will be settled while building:

- The exact Angular folder layout.
- Which fields the OpenAPI document shows.
- How the Keycloak realm export is kept in step with the seed data.
