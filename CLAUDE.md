# CLAUDE.md — Keep the docs up to date

Rules for the AI on this project. They come from the brief in
`references/FeedbackHub-Assignment.pdf`.

**Main rule: when the code changes, the markdown files change too.**
Right away. Not later.

Write in simple words. Short sentences. No big words.

---

## The four files

| File | What it is |
|---|---|
| `README.md` | What the project is, how to run it, how to run the tests, what works, what does not work. |
| `DECISIONS.md` | Choices that mattered. Why we picked this and not that. |
| `SCOPE.md` | What we build, what we do not build, what is unclear, what we assume. |
| `AI_COLLABORATION.md` | How the human worked with AI. **The human writes this one.** |

---

## README.md

Update it when:

- A feature starts working → move it to the "what works" list.
- A feature is broken, missing, or half done → put it in the "what does not
  work" list. Say it plainly.
- A command changes (how to run, how to test, how to build) → fix the command.
  The command must really work.
- A setting or an environment variable is added → add it to the list.

Rule: never write that something works if it does not.

---

## DECISIONS.md

Update it when you pick something and there was more than one choice.

Write four short parts:

1. **Context** — what was the problem.
2. **Options** — what else could we have used.
3. **Decision** — what we picked.
4. **Consequences** — what is good about it, and what is bad about it.

Rules:

- Always write the other options. Never act like there was only one answer.
- Always write the bad side too. Every choice has one.
- If a decision changes later, add the new decision. Do not delete the old one.

---

## SCOPE.md

Update it when:

- We decide to build something → add it to "what we build".
- We decide **not** to build something → add it, and say why.
- The brief is not clear → write the question, and write how we read it.
- We assume something → write the assumption.
- We run out of time and cut something → write what was cut and why.

Rule: it is fine to not build a thing. It is not fine to hide it.

---

## AI_COLLABORATION.md

**The human writes this file. The AI does not write it.**

Why: this file is the human's own story of how they used AI. If the AI writes
it, it is not true any more.

What the AI does:

- Keep the headings. Do not delete them.
- Do not write text inside the sections.
- When the human asks, give the raw prompt and the raw answer, copy-paste, with
  no story added.

The headings come from the brief, part 6:

- 6.1 Tools used, and who did what.
- 6.2 How the human worked with the AI.
- 6.3 Three real examples: the prompt, the answer, what the human changed.
- 6.4 Times the AI was wrong.
- 6.5 A time the human threw away AI work that worked.

---

## Before you finish a session

Check these three things:

- [ ] `README.md` — does "what works / what does not work" match the code now?
- [ ] `DECISIONS.md` — did I choose something today? Is it written down?
- [ ] `SCOPE.md` — did scope change? Was something unclear? Is it written down?

---

## Be honest

- Do not say a thing is done if it is not done.
- Do not say a test ran if it did not run.
- Do not invent an option or a result to make a file read better.
- If you are not sure, say you are not sure.
