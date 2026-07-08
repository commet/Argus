# Argus evals

Three layers, matching the README's reliability claim.

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
