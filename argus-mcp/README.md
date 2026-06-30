# argus-mcp

> **Your AI gives you an answer. Argus gives you a receipt — and checks it against reality on the date you set.**

Argus is an MCP server for **decision accountability**. Instead of grading your
choices, it makes you write down a *falsifiable prediction* and a *check-by
date*, then brings you back on that date to compare what you predicted against
what actually happened. The artifact it produces — a **Judgment Receipt** —
carries one line no other AI tool will: `AI VERDICT … NONE`. The model never
graded you. Reality did.

Works with any MCP host — Claude, ChatGPT, Gemini, or any MCP-compatible client.

```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-04-02      Settled 2026-06-30

  THE REAL QUESTION
    Can we cut over without a maintenance window users notice?
  THE UNVERIFIED ASSUMPTION
    The index rebuild fits inside the replication lag budget.
  HUMAN-ONLY CALL   Whether a 5-minute blip is acceptable.
  …made by          Me. (not the model)

  YOU PREDICTED   "Cutover downtime is under 5 minutes"   (check-by 2026-06-30)
  WHAT HAPPENED   Cutover took 3 minutes, no customer reports.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└──────────────────────────────────  argus · seal → settle ─┘
```

## Why it's different

Most decision tools compete on a *better answer*, a *score*, a *confidence*.
Argus does the opposite, and the opposite is enforced **structurally**, not
promised in prose:

- **There is no verdict tool.** The model cannot grade your decision because no
  `argus_verdict` / `argus_score` tool exists to call. `grep dist/` and see.
- **You can't settle what you never sealed.** `argus_settle` hard-errors without
  a prior `argus_seal` — "no judgment without a falsifiable bet" is a
  precondition, not a suggestion.
- **State is the ledger, not a flag.** A decision's status is the fold of an
  append-only event log, so it can't be faked by calling tools out of order.

## Install

Claude Code:

```bash
claude mcp add argus -- npx -y argus-mcp
```

Or add to your host's MCP config:

```jsonc
{
  "mcpServers": {
    "argus": {
      "command": "npx",
      "args": ["-y", "argus-mcp"],
      "env": {
        // Claude Code expands this. On other hosts, pass an absolute path,
        // or just call argus_init with an absolute argus_dir on first use.
        "ARGUS_DIR": "${CLAUDE_PROJECT_DIR}/.argus"
      }
    }
  }
}
```

> Every tool also takes an explicit `argus_dir` argument, so Argus works on any
> host even when env-variable interpolation doesn't.

## The loop

| Tool | What it does |
|------|--------------|
| `argus_open_decision` | Opens a consequential decision. Runs a restraint gate first — on a flat / low-stakes / reversible / already-closed call it tells you to leave it as is. If it fires, it surfaces **one** neutral question, never a fork or a lean. |
| `argus_seal` | Seals a falsifiable prediction (`predicate` + `check_by`) and captures the receipt's real-question / unverified-assumption / human-only / your-call fields. Refuses an empty predicate or a non-future date. |
| `argus_settle` | On the check-by date, records what reality did and issues the Judgment Receipt. Hard-errors without a prior seal. |
| `argus_check_in` | Returns contracts past their check-by date. If nothing is due, it says so and stops — it doesn't manufacture engagement. |
| `argus_recall` | Reads your own history: a receipt, the open contracts, or a sample-size-caveated track record (never a tier or score). |
| `argus_init` / `argus_config` | Initialize the `.argus` directory; read/write non-spine settings. |

## Data

Everything is local, under `.argus/` in your project (gitignored by default).
No telemetry — `npm ls --prod` is two packages (`@modelcontextprotocol/sdk`,
`js-yaml`). See [SECURITY.md](SECURITY.md).

## An honest limit

Argus removes the verdict from its *tool surface* and walls off settling a bet
that was never made. It cannot stop a model from typing an opinion in free chat
between tool calls — no MCP server can. So Argus doesn't claim "zero judgment";
it surfaces one question, names any faint lean as a known limit, and lets
reality do the grading. `zero judgment` is an asymptote, disclosed — not a badge.

## Develop

```bash
npm install
npm run build
npm test          # deterministic spine + state-machine + path-safety gates
npx @modelcontextprotocol/inspector node dist/index.js
```

MIT licensed.
