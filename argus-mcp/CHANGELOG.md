# Changelog

## 1.4.0 — Document review

Bring an existing document to the receipt machine instead of only a typed
decision. (The `argus_review` tool actually shipped alongside the 1.3.0 work
but was never given its own release entry; 1.4.0 is its first published version
— npm went straight from 1.0.0 to here, so this one catch-up release carries
everything since.)

- **New tool:** `argus_review` — reviews a document (strategy memo / PRD /
  deck text / AI answer) for judgment risk and hands the analysis back to the
  host model: a reviewability score, routed lenses, source units with anchors,
  and the extraction prompt. It is **read-only** — it computes and returns,
  never writing to `.argus`; the falsifiable follow-up it surfaces is sealed
  through the existing `argus_seal` → `argus_settle` loop (one receipt machine,
  no second store). Never a verdict; degrades honestly on unextractable input.
- **Document extraction:** `.pdf` / `.docx` / `.pptx` are text-extracted with
  page/slide anchors; two-column PDFs get gutter detection (no interleaving)
  and table cells are preserved. Scanned or image-only files degrade honestly
  rather than fabricating text. Response is bounded (unit + character budget)
  so a large document can't return a giant tool result.
- **Claim structure:** the extractor links evidence → claim and claim → claim,
  so the review surfaces the argument's load-bearing structure, not a flat list.

## 1.3.0 — Living premises

The receipt's `THE UNVERIFIED ASSUMPTION` line becomes a tracked object.

- **New tools:** `argus_premises` (add / amend / resolve — user-authored,
  provenance-preserving, elicitation-only resolve) and `argus_recheck`
  (mechanical numeric drift on explicit numbers, provenance-tagged `changed`
  assertions for text facts, `apply_to_matching` cross-decision fan-out).
- **Extended:** `argus_recall view="premises"` (provenance + honest staleness),
  `argus_check_in` reports due premise facts (grouped — one fact, one re-check),
  `argus_settle` takes an optional user-attributed `broken_premise_ref` and the
  track record gains a premise-attribution frequency line,
  `argus_seal` promotes a named `unverified_assumption` into the premise set
  (the set is canonical; the receipt renders its summary from the fold).
- **Return loop (passive-server honest):** every successful tool response
  carries a quiet `due_note`; new `argus://premises/due` and
  `argus://premises/{id}` resources; the `/argus-settle` ritual includes the
  re-check choreography.
- **State machine:** premises never self-create, lock at check-by
  (`PREMISE_LOCKED` — no retroactive premise-planting, no retiring the premise
  about to be proven wrong), closed decisions refuse premise events.
- **Privacy:** premise data is never part of the account-sync payload.

## 1.2.1 — Forward-compatible ledger replay

- Unknown-but-versioned ledger events (written by a newer argus-mcp) are now
  skipped silently (`integrity.skipped_unknown`) instead of being counted as
  corruption — an old install never raises a false integrity alarm on a new
  ledger. Ship this before adopting any release that writes new event types.
