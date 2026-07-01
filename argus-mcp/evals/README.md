# Argus evals

Two tiers, matching the README's reliability claim.

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
