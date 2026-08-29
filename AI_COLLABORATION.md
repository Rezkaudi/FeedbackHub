# AI COLLABORATION

How I worked with AI on this project.

The brief asks six questions. This file answers them, one section each.

---

## 1. Which tools, and who did what

**Tool:** Claude Code (Opus), inside VS Code.

**The AI did:** read the brief, wrote the SRS, wrote the first version of
README.md, DECISIONS.md, SCOPE.md and CLAUDE.md.

**I did:** every scope choice. The AI drew a data model. I decided what stayed in
it. I deleted one table and six groups of fields from its design.

**One rule from the start:** I asked for `CLAUDE.md` first, before any document.
It holds the brief's rules as short lines and loads at the start of every AI
session. So a fresh AI, with no memory, still follows the brief.

---

## 2. How I worked

**Documents first. No code yet, on purpose.**

The brief says this app is easy and that AI can build it fast. So the app is not
where the judgment is. The specification is. I wrote that first.

**Every rule has a number** (R-1, R-2, ...). Later, every number becomes a test.
So the tests come from the specification, not from guessing a coverage number.

**One big prompt, then small steps.** The first prompt set the rules and made all
the files. After that I worked in small passes and read every change.

**I check, I do not just read.** A well-written answer can still be wrong. So
after each pass I check the claims against the real files, not against the prose.

---

## 3. Worked examples

> The brief asks for **three**, from three non-trivial parts of the application.
> Here is one. It is from the specification work, because no application code
> exists yet. Two more go here as the code is built.

### Example 1 — the prompt that started the whole project

**The prompt I sent, word for word**

```
Engage ultra-deep reasoning. As a full-stack engineer, deliver the best, most professional solution possible.

Read the file references/FeedbackHub-Assignment.pdf completely and understand every
requirement in it before you do anything else.

IMPORTANT: Do NOT build the web application yet. In this step I only want
study and documentation.

Create exactly these files. Do not create any other file.

At the repository root, the project rule file:

  CLAUDE.md
    Extract from the brief every rule and constraint that must be respected for
    the whole life of this project: coding rules, security rules, documentation
    rules, commit history and commit message rules, testing rules, deployment
    rules, and anything the brief says will be evaluated. Write them as short,
    clear, checkable rules, not as prose. This file is loaded automatically at
    the start of every future AI session, so it must be complete enough that an
    assistant reading only this file still follows the brief correctly. Keep it
    tight and skimmable.

At the repository root, the four required deliverables:

  README.md
    What the project is, the planned stack, how to run it, how to run the
    tests, what works, what does not. Since nothing is built yet, write the
    structure now and leave clear TODO placeholders for the run and test
    sections.

  DECISIONS.md
    The decisions that matter. For each one: the context, the options
    considered, the decision, and the consequences. Include the architectural
    choices and the reasoning behind them. Present real options with real
    trade-offs. Do not pretend there is only one correct answer.

  SCOPE.md
    What will be built, what will deliberately not be built. Include a clear list of
    everything in the brief that is ambiguous and how you suggest interpreting
    it, what I would do next with another week, and my assumptions.

  AI_COLLABORATION.md
    Only the structure, with the exact section headings the brief asks for in
    Section 6 (tooling and division of labor, working method, three worked
    examples, failures, rejection, attribution in history). Leave the content
    empty for me to fill in as I work. Do not invent content.

In the docs/ folder, the study material:

  references/SRS.pdf
    A full Software Requirements Specification: purpose and scope, actors and
    roles, numbered functional requirements so I can trace them, non
    functional requirements (security, performance, accessibility), all data
    entities with their fields, types, relationships and constraints, an ERD
    as a mermaid diagram, business rules, and acceptance criteria for each
    main feature.

Before you write anything, identify for yourself which requirements in the
brief are the most critical, the easiest to get wrong, or the most heavily
weighted in the evaluation. Call them out explicitly in your documents and make
sure your design actually satisfies them.

Choose the simplest design that fully meets the brief. Do not over engineer.

When you are done, reply with:
  - A short summary of what you wrote
  - The decisions you want me to confirm or change before we start building
  - Any questions you have about the assignment

Be honest and direct. If something is risky, unclear, or you are unsure, say
so instead of guessing.
```

The four ideas in it that mattered: **do not build yet**, **make exactly these
files**, **show real options, not one answer**, and **say so if something is
unclear — do not guess**.

### What came back

All six files, in one pass. The SRS had everything I asked for: numbered rules,
the data model, an ERD, business rules, acceptance criteria.

It was good work. But it built **more app than the brief asks for**.

### What I did with it

**First — I deleted what nobody asked for.**

The clearest case: a `status_history` table. It recorded which admin changed a
status, when, and why. Good design. Not in the brief.

Then I checked every table and every field with one question:

> Which numbered rule reads this?

No rule? Delete it.

| Deleted | Where |
|---|---|
| the whole `status_history` table | — |
| six default and version fields | `app_settings` |
| `is_terminal` | `statuses` |
| `search_vector`, `last_activity_at` | `feedback_requests` |
| `moderated_by` | `comments` |
| `invited_by`, `accepted_user_id` | `invitations` |
| `sort_order` | `categories`, `statuses` |

Eleven tables became nine. Every deletion is written up in DECISIONS.md, with
what it costs us.

**Second — I added two things that were missing.**

- Rate limits. Two writes had no limit at all, so a loop was free.
- One real feature flag, that blocks the screen **and** the server. A flag the
  server ignores is not a feature flag.

**Third — I answered what the brief leaves open.**

The brief never names the paging parameters, so the two sides had nothing to
agree on. I named them.

**What I kept, unchanged:** the numbered rules. That was the best idea in the
whole first answer.

---

## 4. When the AI was wrong

### "Similar feedback requests" — it needs an AI model and vectors

The AI added this feature: while you write a new request, the app shows you
similar requests that already exist.

**Why I removed it:** to do it correctly you need an AI model and a vector array.

The model turns each request into a vector — a list of numbers that carries the
meaning of the text. You store that vector in the database, and you compare
vectors to find requests that mean the same thing.

Plain word search cannot replace it. "Add dark mode" and "Night theme" mean the
same thing and share no words.

So the real cost of this feature is:

- an AI model to make the vectors,
- a vector column and a vector index in the database,
- a new vector every time a request is written or edited.

That is a whole extra system. The brief never asks for it. So it is out.

**What I did:** removed it from the SRS. It is in SCOPE.md, in the list of things
we deliberately do not build, with this reason.

---

## 5. Something that worked, and I deleted it anyway

**The `status_history` table.**

It worked. It was well built. No reviewer would have called it a mistake.

**What was wrong with it:** it answers a requirement that does not exist. In the
brief, "history" always means the Git commit history. No screen shows a status
trail. No rule reads one.

**What I did instead:** deleted it, and wrote the cost down honestly. SCOPE.md
says plainly that nothing now records when a status changed or who changed it.
If that is ever needed, it gets built properly.

**Why this was right:** the brief says it is testing judgment on top of what AI
can already produce. Producing more is easy. Choosing what **not** to produce is
the hard part.

---

## 6. How AI commits are marked

Commits made mostly by AI carry this line at the end of the message:

```
AI-Assisted: Claude Code
```

Commits with no such line are written by hand. This is also written in
[README.md](README.md#commit-convention).

**Note:** this starts from the first code commit. The one commit in the
repository now is older than the rule and has no line.
