# MCP verification session — 2026-07-14

Goal: confirm the Argus MCP server "really works" in real host conditions —
every tool outputs correctly at the right moment, the question-asking UI is
sound, and it holds up under repeated/hostile use. Run it and run it to find
problems, then fix them. This is the record.

## What was run

| Harness | What it does | Result |
|---|---|---|
| `npm run loop` | Real built server over stdio, 6 scripted decision journeys, lints every returned surface for spine/contract breaks | **0 RED, 0 yellow** (was 2 RED, 2 yellow) |
| `npm run fuzz` | Real server over stdio, seeded generic + adversarial tool calls (empty/huge/unicode/injection strings, wrong types, bad enums, boundary numbers, malformed dates, extra keys, single-field mutation of valid args), stateful lifecycles | **24,000 calls across 8 seeds: 0 crashes, 0 INTERNAL_ERRORs, 0 malformed envelopes, server alive after every run** |
| `npm run elicit` | Real elicitation-capable MCP client + a plain client; drives the question-asking UI (seal confirm, settle outcome, defer) | **12/12 contracts hold** |
| `npm test` | Unit + integration suite | **848 pass** |

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

### 3. FIXED — Korean users on an English-locale OS were pinned to English forever (the big one)

On first tool use, auto-init wrote `config.yaml` with `locale: <env guess>`.
On any non-Korean OS (`LANG=en_US`, Intl `en-US` — the common case for a Korean
founder on a US-configured laptop) that persisted `locale: en`. Because the
locale chain is **config > content > env**, an explicit config locale ALWAYS
wins — so from then on, a session typed entirely in Korean came back framed in
English (check_in's "You left this open…", premises' close line, etc.). The
user's own Korean words could never reclaim a Korean surface.

Two fixes:
- `init-config.ts` now seeds a locale **only on a positive Korean env signal**
  (KST machine → `locale: ko` once, preserving the intended "first contentless
  surface is Korean" behavior). On the English/default fallback it writes **no
  locale line**, so runtime content-detection stays live and Korean text wins.
- `check-in.ts`'s locale voice-sample was also silently broken: its last-resort
  read used `contract.predicate`, but `ContractEntry` stores `.text` — so the
  sample fell through to `undefined` (→ English) whenever the only due item was
  an open question. Replaced the fragile priority-OR chain with a defensive pool
  of ALL ledger user-text.

Verified: an all-Korean session now surfaces in Korean; an English session
stays English. Guard test: `src/tools/__tests__/init-locale-seed.test.ts`.
This cleared both loop yellows (loop is now 0 RED / 0 yellow).

### 4. VERIFIED — the question-asking UI (elicitation) is sound

- Fires at exactly the right moment: seal only asks when `confirm_draft=true`;
  settle only asks when `outcome` is omitted. No spurious prompts.
- Honors the answer honestly: keep → saved as the user's; reword/skip/decline →
  **nothing saved** (no fabricated authorship); picked settle outcome recorded.
- Degrades gracefully: on a host WITHOUT elicitation, tools never call
  `elicitInput` (which throws) — seal proceeds in text, settle returns a named,
  recoverable `OUTCOME_REQUIRED` ask. No crash, no dead end, no dropped seal.

### 5. VERIFIED — input handling is genuinely robust

24,000 hostile calls did not crash the server, did not escape as
`INTERNAL_ERROR`, and did not produce a malformed envelope. Every bad input
came back as a clean, named, recoverable tool-result error. This is the
LLM-glue invariant holding: broken/guarded paths fail loud and honest.

## Still open (not fixed here)

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
npm test          # 848
```
