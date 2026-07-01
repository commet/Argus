# Contributing to argus-mcp

## The one rule

Argus's spine is **maximum generation, zero judgment**. The whole point is that
this is enforced by *structure*, not by asking the model nicely. So:

- There is **no verdict / grade / score tool**, and there never will be. The
  `spine-drift.test.ts` guard fails CI if a tool name or a `next_action` ever
  contains a judgment verb.
- A receipt's `ai_verdict` is always `null`. The drift guard pins it.
- A track record reports **frequency only** (`judgment_tier` / `judgment_score`
  stay `null`). Meaning-language to the user comes from sample-size-scaled
  frequency statements, never a tier.

If your change needs to relax one of these, it's almost certainly the wrong
change — open an issue first.

## Dev loop

```bash
npm install
npm run typecheck
npm test          # must stay green — these are the spine + state-machine + path gates
npm run build
npx @modelcontextprotocol/inspector node dist/index.js   # manual poke
```

## Adding a tool

1. Add `src/tools/your-tool.ts` exporting a `ToolModule` (input schema with
   `additionalProperties: false`, an `outputSchema`, and `annotations`).
2. Route every path segment through `safeSegment` + `assertInside` — never join
   a raw id.
3. Mutating tools must go through `appendLedger` and derive state from
   `resolveContract` / `guardTransition`; never store a status field.
4. Register it in `src/tools/index.ts` and add a test.

## Tests

- **Tier 1 (here, deterministic):** the `*.test.ts` suites. They must pass with
  no model in the loop and gate publish via `prepublishOnly`.
- **Tier 2 (model-in-the-loop):** spine evals that check verdict-leak and
  over-fire across several models. These require API keys and live under
  `evals/` — run them when changing spine-adjacent prompts. The published claim
  is **tool-surface** verdict-leak; free-chat narration is out of scope (see
  README → "An honest limit").
