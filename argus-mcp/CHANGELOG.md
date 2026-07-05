# Changelog

> Published on npm as **`argus-decision-mcp`**. The package was renamed from
> `argus-mcp` (that name was already taken by an unrelated tool) and its version
> **reset to 1.0.0** for the first release under the new name on **2026-07-03**.
> The `1.3.0` / `1.2.1` entries at the bottom are pre-rename `argus-mcp` history,
> kept for reference — all of that work shipped inside the new-name 1.0.0.

## 1.1.0 — Reconsider loop, drift materiality, localization, document parsing

Everything since the 1.0.0 first release.

- **Reconsider loop (M1/M3):** an in-session ambient due-line and a formalized
  recheck cadence surface what's due without leaving the session; an
  `open_question` left unresolved is nudged back periodically — a fact + a
  handle, never a verdict, and leaving it open stays a valid answer.
- **Drift materiality (M2):** a 3-valued drift engine with canonical unit scales,
  so a re-checked number reports material / immaterial / unknown instead of a
  raw diff.
- **Localization (M4):** runtime language detection localizes the surface tools,
  so a Korean session no longer gets English surfaces.
- **MCP spec compliance:** https is enforced on any API-base override (the
  account token never travels in cleartext), the 2025-06-18 top-level tool
  `title` is emitted, and the README/description are narrowed to the hosts
  actually supported (local **stdio** — no false ChatGPT/Gemini claim).
- **`argus_review` document extraction:** `.pdf` / `.docx` / `.pptx` are now
  text-extracted with page/slide anchors (previously binaries were refused);
  two-column PDFs get gutter detection, tables keep their cells, and scanned or
  image-only input degrades honestly. The extractor links evidence → claim and
  claim → claim, so the review shows the argument's load-bearing structure.
  Response is bounded so a large document can't return a giant result.

## 1.0.0 — First release as `argus-decision-mcp` (2026-07-03)

Rename + version reset from `argus-mcp`. Bundles the full prior surface: the
seal → settle receipt loop whose Judgment Receipt carries `AI VERDICT … NONE`
(the model never grades you, reality does), living premises (`argus_premises` /
`argus_recheck`), the `argus_review` document reviewer (paste/text; binary
extraction landed in 1.1.0), and forward-compatible ledger replay. The
pre-rename entries below detail that work.

---

## Pre-rename history (`argus-mcp` — folded into 1.0.0 above)

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
