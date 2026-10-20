# Failed attempts

> One row per failed fix attempt. `scripts/check-protocol.mjs` reads this file
> and fails the build if a task has **three or more** `FAILED` rows and no
> matching `## BLOCKER` block in `docs/BUILD_STATE.md`.
>
> This is what makes the Three-Strike Rule real rather than aspirational.

| Task | Attempt | Hypothesis | Error (short) | Result |
|---|---|---|---|---|
| — | — | — | — | — |

## Why this file exists

An agent that loops on the same error is not being careful, it is being
thorough in the wrong direction. The fix is not a fourth attempt; the fix is a
written decision about what to do instead, made while the cost of switching is
still low.

The rule, verbatim:

> After **three distinct** fix attempts at the same error: stop. Write a
> BLOCKER block in `docs/BUILD_STATE.md` containing Error / Attempts /
> Hypothesis / Chosen fallback, **then execute the fallback**. A fourth
> diagnostic requires a new entry in `docs/DECISIONS.md`.

"Distinct" is the operative word. Retrying the same command, or re-editing the
same line, does not count as a new attempt.
