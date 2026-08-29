# FeedbackHub

An internal product feedback board.

Employees post feature requests and feedback. Everyone can read them, upvote
them, and comment. An admin sets the status, curates categories, moderates
comments, and configures the app.

The goal: stop the same idea arriving five times by email, and make it visible
what is actually being worked on.

> **Status: no code yet.** Only the documents and the SRS exist. The stack below
> is chosen, not built.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Front end | Angular 20, standalone components, signals, Tailwind | D-16 |
| Back end | Node.js 22, NestJS 11, TypeScript strict | D-17 |
| Architecture | Modular monolith, 8 modules, + 1 email worker | D-18 |
| Database | PostgreSQL 16, Prisma 6 (raw SQL for the board query) | D-19 |
| Shared state | Redis 7 | D-20 |
| Sign-in | Keycloak, self-hosted | D-21 |
| Mail | SMTP + local mail catcher | D-21 |
| Tests | Jest, Testcontainers, Supertest, ATL, Playwright | D-22 |
| Packaging | Docker, Docker Compose, Kubernetes manifests | D-18 |

## How to run it

TODO — nothing to run yet.

## How to run the tests

TODO — no tests yet.

## Configuration

TODO — no environment variables yet. Cookie names and lifetimes will come from
config (D-03).

## What works

Nothing. No code has been written.

## What does not work

Everything. The docs describe the plan, not a running app.

## Commit convention

AI-heavy commits carry the trailer `AI-Assisted: <tool>` in the commit message.
Commits without it are hand-written. The convention starts from the first code
commit; the initial docs commit predates it.

---

## Documents

| File | What is in it |
|---|---|
| [DECISIONS.md](DECISIONS.md) | The 22 choices that mattered, and why. |
| [SCOPE.md](SCOPE.md) | What we build, what we skip, what we assume. |
| [AI_COLLABORATION.md](AI_COLLABORATION.md) | How I worked with AI. Written by hand. |
| [CLAUDE.md](CLAUDE.md) | Rules for keeping these documents true. |
| [references/SRS.pdf](references/SRS.pdf) | Full requirements, 38 pages, with numbered rules (R-nn). |
| [references/FeedbackHub-Assignment.pdf](references/FeedbackHub-Assignment.pdf) | The original brief. |
