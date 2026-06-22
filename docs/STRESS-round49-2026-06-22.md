# R49 — verify gate precision: cross-agent support, worker traceability, error modes

Findings verify#3 (leverage 6) + verify#1 (leverage 5) + robustness#2. All in
`skills/verify/SKILL.md`. This is the gate that decides what counts as `supported`
evidence, so a loose definition launders generic prose into confidence.

## verify#3 — "cross-agent support" was undefined (the core leak)

A claim becomes `supported` only if it passes ≥2 of 5 checks **and one is Evidence
or Cross-agent support**. So cross-agent support is one of just two checks that can
carry a claim. But the check read only "Did another worker independently support
the same direction?" — *support* undefined. If silence or non-contradiction counts,
then a lone generic claim no other worker even mentioned passes as cross-agent
supported. That is precisely the "generic prose sneaks in" failure the threshold
exists to stop.

**Fix:** defined cross-agent support as **an active, independent, affirmative
second assertion** of the same/compatible claim. Stated explicitly: *silence is
not support; non-contradiction is not support.* Labeled the five checks
(Evidence / Specificity / Cross-agent / Framework / Action-clarity) so the "one
must be Evidence or Cross-agent" rule is unambiguous.

## verify#1 — Step 1's worker flag was unenforceable without traceability

Step 1 force-challenges any claim from a worker flagged `error` /
`verification_failed` / `score < 70`. Step 2's claim object already had
`source_worker_ids` — but nothing required the *extraction sources*
(`mix.sections[]`, `scaffold.hidden_assumptions[]`, …) to carry worker attribution,
so `source_worker_ids` could be empty and a flagged worker's claim could slip
through as `supported` because it couldn't be traced back.

**Fix:** made `source_worker_ids` mandatory and specified the trace: mix sections
and scaffold arrays preserve their contributing worker id(s) (team Step 8 records
them); untraceable pure-synthesis claims get `["navigator"]`, never empty. Stated
the enforcement mechanism: a claim whose `source_worker_ids` intersects the Step 1
flagged set is pre-flagged → skips Step 3 → enters Step 4 already challenged.

## robustness#2 — verify had no Error Modes

verify read `workers.json` / `mix.json` / `scaffold.json` with no corruption spec,
despite the plugin-wide defensive-read discipline. Added an **Error Modes**
section. The load-bearing rule: **a corrupt read must never resolve to a higher
confidence than the true state** — an unreadable `workers.json` is NOT "zero
workers" (that would produce a falsely clean `verified`); it quarantines and
reports. Partial writes defer to sail Step 3's interrupted-mid-team handling
(consistent with R47).

## Verification

`node scripts/validate-plugin.js` → passed. Markdown-only.

## Next

R50 (revise): bounded loop-exit — `--max-revisions` escape hatch + a convergence
rule so a perpetually-challenged claim escalates to a human check instead of
re-looping forever.
