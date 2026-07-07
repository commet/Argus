# R52 — corrupt-read parity: one canonical quarantine discipline, no drift list

Teed up by R51's "Next." R51 fixed chart's read path (missing≠corrupt, quarantine
to `<name>.corrupt.<ts>`). This round audits whether *every* reader honors the same
discipline — and finds two that don't, plus a canonical statement that had already
drifted.

## The defect — three readers disagree on what "corrupt" means

clarify Error modes is the canonical reference: quarantine a bad stored file to
`<name>.corrupt.<ts>`, never crash, "applies to every skill that reads stored
session JSON." But:

1. **The canonical "applies to" list was already wrong.** It named
   `(clarify, team, verify, boss, chart)` — omitting **sail** and **revise**, both
   of which read stored JSON (sail implements the quarantine; revise was supposed
   to). A hand-maintained list of "who must do this" drifts the moment a skill is
   added; it had.
2. **boss conflated a corrupt *file* with a malformed *LLM response*.** boss Error
   Modes said only `Invalid JSON: retry once with stricter format enforcement` —
   which is the right move for the boss's own *generated* feedback, but nonsense for
   a `verification.json` on disk that won't parse (there is no generation to
   re-prompt). boss is explicitly in clarify's "applies to" list yet its body
   contradicted it: a corrupt `verification.json` would be retried (pointlessly) or
   read as "verification missing," routing the user to re-verify a step that already
   ran and may have blocked.
3. **revise said only "moved aside and reported."** No `<name>.corrupt.<ts>` token,
   no missing≠corrupt distinction. revise reads the parent's `verification.json`;
   reading a corrupt one as "no challenges" silently drops the exact challenges the
   skill exists to apply — the same danger R51 named for chart, in the skill whose
   whole job is to act on those challenges.

Token drift, too: clarify used `<name>.corrupt.<timestamp>` while chart/verify/sail
used `<name>.corrupt.<ts>`.

## The fix — make the discipline canonical and universal, fix the laggards

- **clarify** (the canonical statement): unify the token to `<name>.corrupt.<ts>`
  (named explicitly as *the* token), fold the **missing≠corrupt** principle in as
  canonical (not just chart-local), and replace the hand-picked skill list with a
  universal rule: *if a skill reads any stored session or version `.json`, it owns
  this discipline — no exceptions, no list to drift.*
- **boss**: split the one line into two — corrupt *stored* artifact → quarantine
  `<name>.corrupt.<ts>` + report (a corrupt `verification.json` is NOT "verification
  missing"); malformed *LLM* feedback (boss's own response) → retry once. The two
  were different failures wearing one bullet.
- **revise**: replace "moved aside" with the explicit quarantine + the
  missing-vs-corrupt split, calling out that a corrupt `verification.json` must not
  read as "no challenges."

verify, sail, chart already conform — they are the reference, untouched. settle
(append-only ledger correction) and log (list-view skip, quarantine-but-count per
R33) are legitimately different read models and are named in the universal rule
without forcing the session-JSON halt semantics onto them.

## Why this is a spine note

Reading a corrupt record as "absent" is the engine quietly deciding a step didn't
happen — and routing the user onward as if the reef weren't there. That is the
mirror clause again: silence that reads as "nothing to check" when something
unreadable actually ran. The honest move is to surface "this ran but I can't read
it," every time, from every reader.

## Verification

`node scripts/validate-plugin.js` → passed.

## Next

R53: the *write* side. R44–52 hardened reads; confirm every write that can be
interrupted is atomic (temp-file + rename) or at least leaves a quarantine-able
partial, so the corrupt-read discipline has a matching corrupt-write guarantee
rather than relying on it never happening.
