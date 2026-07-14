# MCP verification session — 2026-07-14

Goal: confirm the Argus MCP server "really works" in real host conditions —
every tool outputs correctly at the right moment, the question-asking UI is
sound, and it holds up under repeated/hostile use. Run it and run it to find
problems, then fix them. This is the record.

## What was run

| Harness | What it does | Result |
|---|---|---|
| `npm run loop` | Real built server over stdio, 6 scripted decision journeys, lints every returned surface for spine/contract breaks | **0 RED, 2 yellow** (was 2 RED) |
| `npm run fuzz` | Real server over stdio, seeded generic + adversarial tool calls (empty/huge/unicode/injection strings, wrong types, bad enums, boundary numbers, malformed dates, extra keys, single-field mutation of valid args), stateful lifecycles | **24,000 calls across 8 seeds: 0 crashes, 0 INTERNAL_ERRORs, 0 malformed envelopes, server alive after every run** |
| `npm run elicit` | Real elicitation-capable MCP client + a plain client; drives the question-asking UI (seal confirm, settle outcome, defer) | **12/12 contracts hold** |
| `npm test` | Unit + integration suite | **846 pass** |

## Findings and fixes

### 1. FIXED — Korean users got unactionable validation errors (real UX bug)

`localizeToolResult` collapsed **every** `INVALID_INPUT` to a generic
"입력값이 올바르지 않습니다" and a recovery line that says "fix the flagged
argument" — but no argument was flagged. English users saw
"predicate: too small (min 8)"; Korean users saw nothing actionable. For a
Korean-first product this is a dead end at the most common failure point.

Fix: `server.ts` now carries the offending field(s) + machine reason
(`invalid_fields`), and `localize-result.ts` renders Korean that NAMES each
field and why — e.g. `입력값이 올바르지 않습니다 — predicate: 너무 짧습니다
(최소 8자).` Guard tests added. (`src/server.ts`, `src/lib/localize-result.ts`,
`src/lib/__tests__/localize-result.test.ts`.)

### 2. FIXED — self-drive loop was RED for two non-product reasons

- `argus_check_in` rejected the `today_override` test clock: the public tool
  wrapper reused the internal name `argus_check_in` (every other tool got a new
  public name — seal→predict, settle→resolve), so the public/clock-stripped
  version shadows the internal one in `TOOL_MAP`. The server only re-admits the
  clock for public tools under `NODE_ENV=test`, which the loop wasn't setting.
  Fix: the loop (a deterministic test) now sets `NODE_ENV=test`. *(Latent note
  for later: the name reuse means the today_override-capable internal check_in
  is unreachable — harmless for real users, but an inconsistency worth a
  distinct public name someday.)*
- `argus_open_decision` "restraint" journey asserted `harvest_written===false`
  on a flat decision. This is a STALE expectation: `open-decision.ts` records
  the decision quietly in every branch by design ("the gate withholds the
  ceremony, not the record" — recording is maximum-generation, the withheld
  fork is zero-judgment). Fixed the loop to assert the REAL restraint signal
  (`over_fire_gate.fired===false && fork_emitted===false`), and the high-stakes
  journey to assert `over_fire_gate.fired===true` (harvest_written is always
  true, so it never distinguished fire from restraint).

### 3. VERIFIED — the question-asking UI (elicitation) is sound

- Fires at exactly the right moment: seal only asks when `confirm_draft=true`;
  settle only asks when `outcome` is omitted. No spurious prompts.
- Honors the answer honestly: keep → saved as the user's; reword/skip/decline →
  **nothing saved** (no fabricated authorship); picked settle outcome recorded.
- Degrades gracefully: on a host WITHOUT elicitation, tools never call
  `elicitInput` (which throws) — seal proceeds in text, settle returns a named,
  recoverable `OUTCOME_REQUIRED` ask. No crash, no dead end, no dropped seal.

### 4. VERIFIED — input handling is genuinely robust

24,000 hostile calls did not crash the server, did not escape as
`INTERNAL_ERROR`, and did not produce a malformed envelope. Every bad input
came back as a clean, named, recoverable tool-result error. This is the
LLM-glue invariant holding: broken/guarded paths fail loud and honest.

## Still open (not fixed here)

- **2 loop yellows — read-only surfaces surface in English on a Korean journey.**
  e.g. check_in's due-open-question line and premises' close line have
  English-only templates. Real first-impression cost for Korean users; tracked
  as the M4 localization gap. Fix = add Korean variants to those specific
  surface builders (contained but touches several surface strings). Deferred to
  avoid broad surface edits in an unattended session.
- **check_in public/internal name collision** (see finding 2) — give the internal
  tool a distinct name so its test clock isn't shadowed.
- **settle on an elicitation host still needs `what_happened`** from the model
  (only `outcome` is elicited). Defensible (what_happened is the user's free
  description the model carries), but a combined form could be smoother.

## How to reproduce

```bash
cd argus-mcp
npm run loop      # journeys + surface lint  → 0 RED
npm run fuzz      # 800 hostile calls        → all clean
npm run fuzz -- --n 4000 --seed 7
npm run elicit    # question UI              → 12/12
npm test          # 846
```
