# R53 — the write side: atomic temp+rename, the missing half of corrupt-handling

R44–52 hardened the *read* side: every reader now quarantines a corrupt/partial
stored file instead of trusting it. But that whole discipline is a net under a
trapeze with no upper rail — it assumes half-written files happen and catches them.
This round adds the upper rail: stop most half-written files from being produced.

## The defect — "write-once" was never "write-atomic"

The layout doc and four skills assert version artifacts are **write-once**. Reading
the code-of-record carefully, "write-once" means *don't duplicate write-many
artifacts into `session.json`* (a concurrency/merge-conflict property). It says
**nothing about atomicity.** Meanwhile the read side openly expects the failure:

- clarify Error modes: "a prior run was interrupted mid-write, so `session.json` /
  `analysis.json` won't parse."
- verify Error modes: "**Partial write (process killed mid-write)**."

So the system *knows* mid-write truncation occurs and handles it on read — but on
the write side there is no instruction to write atomically. Worse, nothing forbids
writing **in place** over a good file; a kill mid-rewrite would then destroy the
only intact copy, leaving the corrupt-read guard with nothing to fall back to. The
net exists; the thing that should make the net rarely needed does not.

## The fix — a canonical Write Discipline beside the layout

`lib/session/session-layout.md` is the single source of truth for the file layout,
so the atomic-write rule lives there (paralleling clarify Error modes as the read
SSoT). New **Write Discipline (Atomic)** section:

- **Temp + rename, never in place.** Write full content to `<name>.json.tmp`, then
  atomically `rename` over `<name>.json`. A reader always sees the complete old or
  complete new file — never a truncation. Writing in place is forbidden.
- **A leftover `*.json.tmp` is a crashed-write signature, not an artifact.** The
  canonical file beside it is intact. Readers ignore `*.json.tmp` /
  `*.stream.partial` — never parse one, never quarantine one (it is a discarded
  attempt, not a corrupt record). This is wired back into clarify's read guard so
  the two sides agree on what a `.tmp` means.
- **Write a set-valued artifact once, when complete.** `workers.json` is written a
  single time after the full set is assembled, never appended entry-by-entry —
  closing the *other* partial (a syntactically valid file holding fewer items than
  planned, which atomic single-file writes alone wouldn't catch). An interrupted
  *run* leaves no `workers.json`, which reads correctly as "team didn't finish."
- **Universal, no drift list** — same no-hand-picked-list rule R52 established for
  reads.

Also added `*.json.tmp` to the shared-session gitignore noise list so a crashed
write's scratch file never travels to a teammate.

## Why this is a spine note

A corrupt-read guard with no atomic-write counterpart is honesty theater: it
performs care on read while the write path can still nuke the only good copy. The
honest design makes the dangerous state *unreachable by construction* where it can,
and surfaces the residue where it can't — not one without the other.

## Verification

`node scripts/validate-plugin.js` → passed.

## Next

R54: concurrency. Atomic single-file writes protect one writer; two teammates (or
two sessions, as this very project just hit) writing the *same* version dir or
appending the *same* ledger need a defined last-writer/merge rule. Audit whether
`drafts[]` append and ledger append are safe under genuine concurrent writers, or
only under the assumed single-writer-at-a-time.
