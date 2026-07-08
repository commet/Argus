# Argus evals

Five layers. The first three are deterministic (no API key, no flake — CI-grade);
the last two put a model in the loop and answer questions no unit test can:

| layer | command | question it answers | model |
|---|---|---|---|
| contract | `npm run loop` | is every returned surface correct, honest, spine-safe? | — |
| **life** | `npm run life` | **what is 75 days of cohabitation like — nag, silence, dignity?** | — |
| unit/protocol | `npm test` | structural gates (433+ tests incl. real-stdio round-trip) | — |
| spine eval | `npm run eval` / `eval:review` | do models using these tools leak verdicts? | ✓ |
| **experience** | `npm run eval:experience` | **would a real person, mid-work, keep this?** | ✓ |

## Experience loop — `npm run eval:experience` (the product-level judge)

Personas (`personas.mjs`) live day-stamped work lives against the REAL server:
the host model gets the real instructions + real schemas (exactly what Claude
Desktop/Code sees) and freely decides when — and whether — to touch Argus.
An opus judge then scores the transcript AS the persona: ride-along, earned
return, dignity, restraint, clarity + exactly ONE thing to cut and ONE to add.
Probes no unit test can see: unprompted adoption (does the host reach for Argus
at a decision moment nobody named?), the 3-week return payoff, the
debt-collector test on an overdue pile, restraint against a hostile skeptic.
Results → console + `evals/out/experience-latest.json` → feed
`POLISH-BACKLOG.md` and product decisions.

## Life loop — `npm run life` (75-day cohabitation, deterministic)

A Korean founder's sparse calendar simulated day by day against the real server
(the harness owns the clock via `today_override`). Measures pressure, not
correctness: identical-line nag streaks, quiet-day quality, overdue voice
(information vs frozen line), post-settle silence, verdict-language on any day.
This loop caught: a 20-day byte-identical premise nudge (fixed: the line now
ages honestly), and the quiet-day greeting falling back to English on an
all-Korean ledger (fixed: ledger-wide voice sample).

## Self-drive loop — `npm run loop` (deterministic, no API key)

The web-app analog of a Playwright run, but an MCP server has no browser to
drive — a tool "surface" is just the text it returns. So `evals/loop.mjs` spawns
the **real built server** over stdio (`node dist/index.js`), walks it through 6
realistic decision journeys (16 real tool calls: seal→settle, the return loop,
restraint on a flat case, a doc review, honest error paths), and **lints every
surface it actually returns** for spine + contract breaks via
`src/lib/surface-lint.ts` (the same verdict-language source the crux guard uses).

```bash
npm run loop        # builds, then drives + lints the real server
```

Every step prints the surface the server ACTUALLY returned, so a human (or the
agent driving the loop) can read what the user would see — the point is to look,
not just to green/red.

RED = a spine/contract break (a surface with no human line, an error with no
recovery path, or a surface that leaks a verdict) → exit 1, gates a watch loop or
CI. yellow = a smell, not a failure:
- **language-drift** — a Korean-input journey got a >65%-English surface back
  (some read tools localize, some don't yet). Measured by Hangul share of the
  prose, so an English frame that merely quotes the user's Korean still trips it.
- **surface-too-long / no-next-actions** — polish smells.

It catches exactly the LLM-glue failure: a wire that silently breaks and returns a
plausible-but-empty surface turns red here instead of shipping.

## Tier 1 — deterministic gates (no model, runs in CI)

These are the `src/**/*.test.ts` suites (`npm test`). They prove the structural
spine with no model in the loop and gate `npm publish` via `prepublishOnly`:

- settle without a prior seal is refused (`NO_PRIOR_SEAL`)
- a seal without a prior open does not evaporate (B1 regression)
- empty predicate / non-future date refused
- a crux carrying a directional lean is refused
- path traversal (`..`, `\`, `%2e`) blocked
- no verdict/grade/score tool exists; receipts carry `ai_verdict: null`;
  track record never emits a tier/score (`spine-drift.test.ts`)

## Tier 2 — model-in-the-loop spine eval (needs an API key)

```bash
ANTHROPIC_API_KEY=sk-... node evals/run.mjs
# optional:
ARGUS_EVAL_MODELS=claude-sonnet-4-6,claude-haiku-4-5-20251001 \
ARGUS_EVAL_JUDGE=claude-opus-4-8 node evals/run.mjs
```

For each scenario in `cases.mjs`, every generation model is given the **real
server instructions** and asked how it would use the tools. We measure:

| Metric | What it catches |
|---|---|
| **over-fire on flat cases** | manufacturing a fork on a trivial/reversible/already-closed/vent case |
| **crux carries a lean** | the surfaced question smuggling a verdict (run through `validateCrux`) |
| **free-text verdict leak** | the chat message stating which way to go (judged by an opus judge) |

### Honest framing

The published badge is **tool-surface verdict-leak**, which is structurally 0 —
no tool can emit a verdict. The **free-text leak** this harness reports is the
harder, honest number: a model can still type an opinion in chat between tool
calls, and no MCP server can stop that. Report both; never collapse them into a
single "0%".
