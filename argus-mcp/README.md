# argus-decision-mcp

[![npm version](https://img.shields.io/npm/v/argus-decision-mcp.svg)](https://www.npmjs.com/package/argus-decision-mcp)
[![npm downloads](https://img.shields.io/npm/dm/argus-decision-mcp.svg)](https://www.npmjs.com/package/argus-decision-mcp)
[![license](https://img.shields.io/npm/l/argus-decision-mcp.svg)](./LICENSE)

> **Keeping Judgment Human.**

> **Your AI gives you an answer. Argus gives you a receipt — and checks it against reality on the date you set.**

Argus is an MCP server for **decision accountability**. Instead of grading your
choices, it makes you write down a *falsifiable prediction* and a *check-by
date*, then brings you back on that date to compare what you predicted against
what actually happened. The artifact it produces — a **Judgment Receipt** —
carries one line no other AI tool will: `AI VERDICT … NONE`. The model never
graded you. Reality did.

Runs on any MCP host that supports local **stdio** servers — Claude Desktop,
Claude Code, and other clients that launch a local process. (Remote-only
connectors that require an HTTP transport aren't supported yet — see the roadmap.)

```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Prediction saved 2026-04-02      Result recorded 2026-06-30

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
└──────────────────────────  argus · prediction → reality ─┘
```

## Why it's different

**It is not a receipt of what your *agent* did.** A growing set of tools now
log an AI coding run — prompt captured, files touched, checkpoint saved, replay
path written down. That receipt is about the *machine's* actions over one run.
Argus receipts something no run-logger can: *your* judgment call, in your own
words, opened again on a date you set and settled against **reality** — not
against a model's opinion, and not against a diff. Machine-action receipts and
judgment receipts are different primitives; you can keep both.

Most decision tools compete on a *better answer*, a *score*, a *confidence*.
Argus does the opposite, and the opposite is enforced **structurally**, not
promised in prose:

- **There is no verdict tool.** The model cannot grade your decision because no
  `argus_verdict` / `argus_score` tool exists to call. `grep dist/` and see.
- **You can't record a result without a saved prediction.** `argus_resolve`
  hard-errors without a prior `argus_predict` — "no judgment without a falsifiable prediction" is a
  precondition, not a suggestion.
- **State is the ledger, not a flag.** A decision's status is the fold of an
  append-only event log, so it can't be faked by calling tools out of order.

## Install

Claude Code:

```bash
claude mcp add argus -- npx -y argus-decision-mcp
```

Or add to your host's MCP config. **Zero config works**: with no `env` at all,
your ledger lives in `~/.argus`.

**Claude Code** (expands `${CLAUDE_PROJECT_DIR}`, so a per-project ledger works):

```jsonc
{
  "mcpServers": {
    "argus": {
      "command": "npx",
      "args": ["-y", "argus-decision-mcp"],
      "env": {
        // OPTIONAL — per-project ledger. Omit entirely to use ~/.argus.
        "ARGUS_DIR": "${CLAUDE_PROJECT_DIR}/.argus",
        // OPTIONAL — connect to your Argus account so sealed predictions get an
        // email at their check-by date (the Companion Brief) and show up in the
        // web dashboard. Issue the token in the web app (Settings → sync token).
        // Leave it unset to stay fully local (the privacy-preserving default).
        "ARGUS_TOKEN": "argus_pat_…",
        // OPTIONAL — the timezone that decides when a check-by date becomes
        // "today". Unset = your machine's local timezone (usually right).
        // Set it only if your machine's clock zone isn't where you live:
        "ARGUS_TZ": "Asia/Seoul",
        // OPTIONAL — opt in to anonymous usage telemetry (OFF by default). Sends
        // a random install id + which tool ran + version/platform; never your
        // decisions or token. Honors DO_NOT_TRACK. See SECURITY.md → Telemetry.
        "ARGUS_TELEMETRY": "1"
        // "ARGUS_API_URL": "https://argus.voyage"  // override only for self-host
      }
    }
  }
}
```

**Claude Desktop** does **not** expand `${...}` variables — a literal
`${CLAUDE_PROJECT_DIR}` would fail on every call (Argus names this error when
it happens). Either omit `ARGUS_DIR` (→ `~/.argus`) or use an absolute path:

```jsonc
// macOS
"env": { "ARGUS_DIR": "/Users/you/.argus" }
// Windows — also note the command form below
"env": { "ARGUS_DIR": "C:\\Users\\you\\.argus" }
```

**Windows** hosts often can't launch bare `npx` (it's `npx.cmd`). If the server
fails to start, use:

```jsonc
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "argus-decision-mcp"]
}
```

> `argus_dir` is **optional** on every tool: omit it and it resolves from
> `ARGUS_DIR`, then falls back to `~/.argus`. A per-call `argus_dir` still
> wins — so Argus works on any host even when env-variable interpolation
> doesn't.

## Your first receipt (2 minutes)

You never call these tools by name. Once the server is connected, you just
talk to your AI in plain language and it calls the right tool for you. One
full loop — from saving a prediction to recording what reality did — looks like
this:

**1 · Save a prediction** — before you commit to a decision, tell your AI:

> **You:** "I'm shipping the new onboarding flow next week. Save this prediction:
> signups go up at least 10% by the end of the month."

Argus records your predicate and a check-by date. Nothing is scored — it's a
prediction against reality, not a grade from the model.

**2 · Update a fact** *(optional, any time before the date)* — if a fact
your decision leaned on might have moved:

> **You:** "Update the signup number behind my onboarding decision. Has it
> changed since I saved the prediction?"

Argus compares the new number to the baseline and tells you if it drifted. It
returns the handle — whether to revisit the decision stays your call.

**3 · Record the result on the check-by date** — when the date arrives:

> **You:** "Record the result of my onboarding prediction. Signups went up 14%."

Argus prints the **Judgment Receipt** at the top of this page — with
`AI VERDICT … NONE`. You made the call; the record contains what reality did,
not a model's grade.

That's the whole spine. Everything below is detail on top of these three steps.

## The everyday loop

Argus now exposes six tools named for the job they do. You do not initialize
it first, choose a ritual, or learn its internal state machine. The first useful
call creates the local record automatically.

For most decisions the loop is simply:

1. **`argus_capture`** — capture a decision's premises and open questions, in your own words.
2. **`argus_predict`** — make a falsifiable prediction and the date reality can answer it.
3. **`argus_check_in`** — see only what needs attention now.
4. **`argus_resolve`** — record what actually happened, without a score or verdict.

`argus_patterns` reads what is already on record — past decisions and how often
your predictions held. `argus_settings` handles the few preferences and
account-sync controls a user may need.

| Tool | What it does |
|------|--------------|
| `argus_capture` | Captures one decision's premises and open questions in the user's own words, without deciding for you. Its actions add assumptions and open questions, record your answer, update an external fact, change an untested prediction, or close a decision that no longer needs an outcome. |
| `argus_predict` | Makes a falsifiable prediction (`predicate` + `check_by`) in the user's words. An Argus-drafted line is marked honestly and shown as a one-tap draft to keep, reword, or skip. |
| `argus_check_in` | Shows only predictions past their check date, external facts due for an update, and open questions due for reconsideration. If nothing needs attention, it stops. |
| `argus_resolve` | Records what actually happened and issues the Judgment Receipt. Reality supplies the outcome; Argus does not grade it. |
| `argus_patterns` | Reads active decisions, all records, one Judgment Receipt, one decision's context, or the accumulated frequency of outcomes. Read-only. |
| `argus_settings` | Reads or updates language, quiet reminders, opt-in premise sync, and explicit account sync. Initialization is automatic. |

## Living premises

The receipt's sharpest line — `THE UNVERIFIED ASSUMPTION` — used to be written
once when a prediction was saved and then go dead. Now it's a **tracked object**: name the premises
a decision rests on, correct the ones the model got wrong (your edit is part of
the record), and re-check the load-bearing external facts against reality while
the bet is still open. When a rate hike breaks the premise under three of your
decisions, that's **one** re-check, not three.

Honest limits, stated up front: an MCP server is passive — nothing wakes it
between saving a prediction and recording its result. Every tool response can
carry a quiet `due_note`, `argus_check_in` reports due items, and the single
`argus://attention` resource lets capable hosts auto-inject what needs attention. No
separate prompt ritual is advertised. Anything more periodic (cron, reminders)
belongs to your host or habits, not this server.
A premise that never gets re-checked shows up honestly as `never re-checked` —
Argus does not pretend liveness.

## Data

Everything is local, under `.argus/` in your project (gitignored by default) —
an append-only `ledger.jsonl` **you own**: plain JSON lines, no lock-in,
receipts render to shareable text. **No telemetry by default.** The only network
call Argus makes out of the box is the opt-in account sync: if — and only if —
you set `ARGUS_TOKEN`, a saved prediction or recorded result is POSTed to your own Argus
account so it can email you at its check-by date. Separately, you can opt in to
**anonymous** usage telemetry with `ARGUS_TELEMETRY=1` (a random install id +
which tool ran + version/platform, never your decisions or token; honors
`DO_NOT_TRACK`) — see SECURITY.md. **Premise data stays on your machine
by default** — it is not part of the sync payload. There is exactly one switch
that changes this: `argus_settings` with `action:"update"` and
`premise_sync:true` (off unless you set it)
sends a saved decision's *monitored* premises along, so your account's
autonomous premise-watch can re-check them against reality and email you when
one materially moves. Unset the token and Argus never touches the network.
See [SECURITY.md](SECURITY.md).

## Measured

The structural claims are tested, not asserted — `npm test` runs deterministic
gates (no verdict tool exists, settle-without-seal refused, path traversal
blocked, receipts carry `ai_verdict: null`). A model-in-the-loop spine eval
(`npm run eval`, 12 scenarios, opus judge) measured, across Sonnet 4.6 and
Haiku 4.5:

| | over-fire on flat cases | crux carries a lean | free-text verdict leak |
|---|---|---|---|
| Sonnet 4.6 | 0 / 6 | 0 / 12 | 0 / 12 |
| Haiku 4.5 | 0 / 6 | 0 / 12 | 1 / 12 |

Tool-surface verdict leak is **0 by construction**. The one free-text leak
(Haiku, on "salad or sandwich") is exactly the limit below — a model can still
type an opinion in chat, and Argus reports that number rather than hiding it.

## An honest limit

Argus removes the verdict from its *tool surface* and walls off settling a bet
that was never made. It cannot stop a model from typing an opinion in free chat
between tool calls — no MCP server can. So Argus doesn't claim "zero judgment";
it surfaces one question, names any faint lean as a known limit, and lets
reality do the grading. `zero judgment` is an asymptote, disclosed — not a badge.

## The judgment kernel (for contributors)

Under the six tools sits a versioned **judgment kernel** (`src/v3/`) — the
semantic core that the web app, Telegram, and plugin surfaces all fold through,
so a decision's *meaning* can't fork per surface. It is documented normatively in
[`../docs/DESIGN-decision-knowledge-kernel-v6-final-2026-07-14.md`](../docs/DESIGN-decision-knowledge-kernel-v6-final-2026-07-14.md);
this section is the map, not the authority.

**What it is.** Not a memory store and not a personal ontology — a **judgment
ledger**. It records time-stamped *acts* ("the user approved this sentence as a
judgment at 18:20"), never a guess at a mind's state. It borrows parts from event
sourcing, W3C PROV-O, preregistration, and Palantir's object/action/authority
split — but its canon is *the user's authored judgment*, not the world's current
state.

**The shape, compressed:**

- **Six objects** — Judgment · Premise · Return Contract · Observation ·
  Resolution Assertion · Closure. Each also declares what it *deliberately drops*
  (a Judgment drops numeric confidence; a Premise drops implicit/unconscious
  premises) — a type that can't name what it drops is accumulation, not abstraction.
- **Four layers by authority** — Proposal (AI/human suggestion) → Assertion
  (sourced claim) → **Authorial Act (human-only: seal, adopt, close)** → System
  Event. A user-owned judgment exists *only* once an Authorial Act attaches.
- **Three cross-sections** on every event — Provenance (where it came from),
  Authority (who authorized it), Temporal (`occurred_at` vs `recorded_at` vs
  `authorized_at`, kept apart so hindsight can't leak into the contemporaneous
  record).
- **A 14-article constitution**, each tied to a machine enforcement point — "an
  article without an enforcement point is a wish."

**Enforced, not promised** — the same structural spirit as the tool surface:

| Invariant | Where it's enforced |
|---|---|
| An AI proposal can't silently become a human judgment | `zAuthorial` requires `authorized_by.kind === 'human'` + authorization evidence (`src/v3/types.ts`) |
| The same events fold to the same state on every surface | deterministic reducer (`src/v3/reducer.ts`) + cross-surface conformance |
| Sealed meaning is append-only; a correction is a new act | reducer immutability + supersession fixtures |
| `still_pending` / `return_deferred` are never terminal | resolution taxonomy is `answered` / `indeterminate` / `moot` only |
| The twelve "betrayals" can't happen | `src/v3/constitution.test.ts`, `corpus-golden.test.ts` over `fixtures/dkk-corpus.ts` |

**Three rules if you touch it:**

1. **Don't fork the reducer.** Every surface imports the one kernel
   (`src/v3/index.ts`); the web app reaches it through `src/lib/decision-kernel.ts`.
   A per-surface state machine is exactly what this design forbids.
2. **Never repair a semantic mistake by editing or deleting events** — use a new
   authorized command, or an additive migration with an ADR and fixtures.
3. **v2 data stays v2** until the user explicitly reforges it. The legacy adapter
   (`src/v3/legacy-v2.ts`) reads old encodings and reports loss; it never rewrites
   the original.

**Status — honest.** The kernel is **structurally implemented and tested, not
value-proven.** The user-value comparison (P5) is on **HOLD**; run its
deterministic gate only against real matched data, and never fill an absent
measurement with zero:

```bash
npm run eval:p5   # → GO / narrowed-continuation / NO-GO
```

Do not read "the code is ready" as "P5 passed" or "the kernel is GA."

## Develop

```bash
npm install
npm run build
npm test          # deterministic spine + state-machine + path-safety gates
npx @modelcontextprotocol/inspector node dist/index.js
```

MIT licensed.
