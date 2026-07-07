# R56 — idempotent re-entry: a second run must converge, not accumulate

This closes the durability arc R52–55 opened: R52 hardened reads, R53 made writes
atomic, R54 made concurrent writes convergent, R55 made a crashed chain route back
to the right step. R55's consequence is that **re-running a sub-step is now the
normal recovery path** — so R56 asks the obvious next question: is re-running safe?

## The defect — re-entry safety was accidental, and boss broke it

Most sub-steps happen to be idempotent, but none *declared* it and one wasn't:

- **verify** overwrites `verification.json` — idempotent by overwrite. ✅
- **team** reuses the version dir on a crashed run (the `workers.json` marker) and a
  *complete* set routes onward via R55, not back into team. ✅
- **settle** is event-sourced: Step 1 replays the ledger by `id`, a closed contract
  is never re-surfaced as due, so a second run never appends a duplicate `settle`.
  Append-only + replay-by-id = idempotent. ✅
- **boss** ✗ — Step 6 "Update scaffold.json: `boss_concerns_applied[]`,
  `boss_concerns_rejected[]`, routed next actions / human checkpoints" never said
  *set* vs *append*. Folding concern fixes into `scaffold.next_actions[]` /
  `human_required_checkpoints[]` by appending means a re-run — a crash-then-resume,
  or a plain second `/argus:boss` — **doubles the routed actions and re-lists
  already-applied concerns.** R55 made that re-run normal, turning a latent bug into
  a reachable one.

The deeper problem: idempotency held by luck across four skills and nobody had
written down that it MUST hold. R55 promoted re-entry to a routine event; an
unstated invariant under routine stress is a future regression.

## The fix — declare the invariant, fix the one violator

Canonical section added to session-layout, **"Re-entry Is Idempotent"**: a sub-step's
output is a pure function of its upstream artifacts — run it twice on the same
inputs, get the same on-disk state.

- File-writing steps **overwrite and recompute, never append**; mutations folded
  into a shared file (boss → scaffold) are **set/replace keyed by a stable id**.
- Event-sourced writes achieve the same via **replay-collapse by id** (the ledger
  model) rather than overwrite.
- The test, stated plainly: "if this runs twice on the same inputs, is the on-disk
  state identical?" If it appends / bumps / re-applies, it is a re-entry bug —
  because R55 guarantees it *will* sometimes run twice.

boss Step 6 fixed: SET (not append) `boss_concerns_applied[]`/`rejected[]`; fold
routed actions/checks **keyed by concern id, replace-if-present, never blind-append**.

## Why this is a spine note

A re-run that silently doubles routed actions hands the user a scaffold that looks
busier than the decision warrants — manufactured work-items that no concern actually
generated. That is over-fire by accident (the mirror clause): the tool inflating the
ceremony because a recovery path wasn't idempotent. Honest recovery leaves the same
decision it found, not a padded one.

## Verification

`node scripts/validate-plugin.js` → passed.

## Durability arc (R52–R56) — closed

| R | invariant added |
|---|---|
| R52 | reads: corrupt ≠ missing, one canonical quarantine, no drift list |
| R53 | writes: atomic temp+rename; corrupt-write made rare by construction |
| R54 | concurrency: dirs authoritative, drafts[]/ledger converge under concurrent writers |
| R55 | crash: phase derived from artifacts, not a stale scalar |
| R56 | re-entry: re-running a step converges, never accumulates |

## Next

R57: leaves a finished topic and opens the next surface. Candidate — the **clarify
framing-lock** under resume/concurrency: if a session's `frame_status` /
`real_question` is re-derived on a resumed run, can a second clarify pass silently
re-open a framing the user already locked (the inverse of the over-fire guard)?
Audit whether locked framing is immutable across re-entry the way drafts are.
