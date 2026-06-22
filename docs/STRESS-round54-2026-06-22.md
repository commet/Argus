# R54 — concurrency: atomicity is not isolation (lost-update on drafts[] + ledger)

R53 made each write atomic. R54 closes the gap R53 explicitly left open: an atomic
write still loses data under concurrent *writers*. This project hit the exact bug
mid-session — two Claude instances on one repo — so it is not hypothetical.

## The defect — lost update survives atomic writes

Atomicity prevents a torn file; it does nothing about isolation. The race:

```
writer A reads session.json (v1)        writer B reads session.json (v1)
A appends draft X → atomic write (v2)
                                         B appends draft Y → atomic write (v2')
```

Both writes are individually complete. But B wrote on top of the v1 it loaded, so
v2' contains draft Y and **not** draft X — A's draft pointer is silently gone. The
`versions/{X}/` dir is fine on disk (write-once, unique label), but `session.drafts[]`
no longer points at it, so chart/checkout/promote can't see it. Two surfaces have
this read-modify-write shape:

1. **`session.drafts[]` append** (team Step 10, and every `--revise`).
2. **The ledger** (`ledger.jsonl`) if any writer does read-modify-write-whole-file
   instead of true append — concurrent seal/settle/helm would drop a line.

The session schema *claimed* drafts[] is "append-mostly so concurrent team commits
don't conflict" — but that was about **git merge** of two different author-suffixed
session dirs, never about two writers to the **same** session.json. Within one
session, it was an unguarded lost-update.

## The fix — make the dirs the truth; merge, don't overwrite; true-append the ledger

Canonical rule added to session-layout (Draft Tree Semantics → Concurrency):

- **The version directories are authoritative; `session.drafts[]` is a derived
  index.** Each dir is write-once under a unique label, so concurrent writers never
  collide on the dirs — only on the index that points at them.
- **Every session.json write re-reads immediately before writing and merges** —
  rebuild drafts[] as (current-on-disk ∪ your new draft), dedup by `version_label`,
  reconciled against the dirs present (a dir with no entry → add it; dirs win). This
  makes drafts[] convergent under any write order. Scalar pointers
  (`active_draft_id`, `phase`) stay last-writer-wins, but the merge still runs so a
  pointer update never clobbers membership. Optional cheap optimistic guard: compare
  `updated_at` read-vs-disk before writing.
- **Readers reconcile too** (chart Step 3 now): never render fewer drafts than there
  are version dirs — a stale index must not hide a concurrently-created draft.
- **Ledger = true append (`O_APPEND`), never read-rewrite-whole-file** (settle Step
  3, applies to settle/helm/watch). Append-only is what lets concurrent writers and
  git merges both converge.

Applied at the write/read points: team Step 10 (re-read-then-union), settle Step 3
(true append), chart Step 3 (reconcile against dirs).

## Why this is a spine note

A lost draft is the tool silently discarding work the user did — the most direct
possible violation of "don't lose the user's decision record." It read as fine on
every screen (atomic writes, no error) while a branch quietly vanished. Honest
durability means the dangerous interleaving is convergent by design, not "unlikely."

## Verification

`node scripts/validate-plugin.js` → passed.

## Next

R55: failure-mid-chain. sail orchestrates clarify→team→verify→boss as sub-steps;
if step N writes its artifact then the chain dies before step N+1, what does
`--resume` reconstruct? Audit that every sub-step is independently resumable from
its on-disk artifacts (phase re-derivation), not only from a session.phase that may
not have been updated before the crash.
