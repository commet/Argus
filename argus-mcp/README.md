# argus-decision-mcp

[![npm version](https://img.shields.io/npm/v/argus-decision-mcp.svg)](https://www.npmjs.com/package/argus-decision-mcp)
[![npm downloads](https://img.shields.io/npm/dm/argus-decision-mcp.svg)](https://www.npmjs.com/package/argus-decision-mcp)
[![license](https://img.shields.io/npm/l/argus-decision-mcp.svg)](./LICENSE)

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
- **You can't settle what you never sealed.** `argus_settle` hard-errors without
  a prior `argus_seal` — "no judgment without a falsifiable prediction" is a
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
full loop — from sealing a prediction to letting reality grade it — looks like
this:

**1 · Seal a prediction** — before you commit to a decision, tell your AI:

> **You:** "I'm shipping the new onboarding flow next week. Seal a prediction:
> signups go up at least 10% by the end of the month."

Argus records your predicate and a check-by date. Nothing is scored — it's a
prediction against reality, not a grade from the model.

**2 · Re-check a premise** *(optional, any time before the date)* — if a fact
your decision leaned on might have moved:

> **You:** "Re-check my onboarding decision — did the weekly signup number
> change since I sealed it?"

Argus compares the new number to the baseline and tells you if it drifted. It
returns the handle — whether to revisit the decision stays your call.

**3 · Settle on the check-by date** — when the date arrives:

> **You:** "Settle my onboarding prediction. Signups went up 14%."

Argus prints the **Judgment Receipt** at the top of this page — with
`AI VERDICT … NONE`. You made the call; reality graded it, not the model.

That's the whole spine. Everything below is detail on top of these three steps.

## Two loops

Argus runs two loops side by side — the same three habits its author
uses daily: **봉인하기** (seal it before you ask the AI) · **드러내기**
(surface claims you accepted without checking) · **돌아보기** (return when
reality has answered):

- **The daily watch** (`argus_watch`) — turns over once a *day*. In the morning
  (or whenever a session starts) you anchor one line: today's aim, your working
  hypothesis, where you lean. While you work, you capture the things that
  usually evaporate: a claim you accepted without checking, a premise you
  haven't verified, a question you're deferring. Tomorrow's `check_in` mirrors
  yesterday's line back — *"so, how did it go?"* — as a question, never a grade.
  An anchor is a **note, not a prediction**: nothing about it is scored, counted, or
  streaked, ever.
- **The decision loop** (everything below) — plays out over days to months.
  When a capture turns out to be load-bearing, *you* promote it: open the
  decision, seal a falsifiable prediction, track its premises, and let reality
  settle it into a Judgment Receipt.

The watch builds the habit; the decision loop builds the record.

## The loop

**The spine is three tools:** **`argus_seal`** (write the falsifiable prediction) →
optional **`argus_recheck`** (has a load-bearing premise moved?) →
**`argus_settle`** (reality answers, on the date). If you only ever learn
these three, Argus works. Everything else in the table supports that spine —
reach for it when you need it, not before.

| Tool | What it does |
|------|--------------|
| `argus_watch` | The daily watch. `anchor` keeps today's one-line aim (your words, verbatim); `capture` notes an unchecked claim / unverified premise / deferred question mid-work without opening a decision; `list` reads the recent log. Anchors are mirrored back by the next `check_in` as a question — never evaluated, never counted in any record. |
| `argus_open_decision` | Opens a consequential decision. Runs a restraint gate first — on a flat / low-stakes / reversible / already-closed call it tells you to leave it as is. If it fires, it surfaces **one** neutral question, never a fork or a lean. |
| `argus_review` | Reviews an existing document (strategy memo / PRD / deck text / AI answer) for judgment risk: reviewability score, routed lenses, source units with anchors, and the extraction prompt — then hands the analysis to you. Degrades honestly on unextractable input; never a verdict. End by sealing one follow-up. |
| `argus_seal` | Seals a falsifiable prediction (`predicate` + `check_by`) and captures the receipt's real-question / unverified-assumption / human-only / your-call fields. Refuses an empty predicate or a non-future date. If you seal without naming the assumption, it's recorded as an explicit **skip** — never a forced gate (which would just eject the tiredest user), never a silent blank. With `ARGUS_TOKEN` set, the prediction also syncs to your account so the Companion Brief can email you at its check-by date. |
| `argus_premises` | Tracks the **premises** a decision rests on — the facts and open questions behind it. `add` records them (echoed back in full); `amend` takes your correction verbatim (the AI's original stays on the record — the edit is the signal); `resolve` closes an open question **in your own words** (it cannot offer options or leans — that shape doesn't exist here). Premises lock once the check-by arrives: no retroactive premise-planting, no retiring the one about to be proven wrong. |
| `argus_recheck` | Re-checks one premise against reality between seal and settle. The host researches the current fact; the tool compares **explicit numbers** mechanically (never regex-parses prose) or records the host's provenance-tagged `changed` assertion for text facts. First check is a baseline and never alerts. When the fact drifted: it says so and returns the handle — whether to revisit the decision stays your call. `apply_to_matching` re-checks the same fact under your other decisions at once. |
| `argus_settle` | On the check-by date, records what reality did and issues the Judgment Receipt. Hard-errors without a prior seal. Optionally records **which premise broke** (your attribution, never inferred) — over time your track record can say "3 of your 4 missed bets traced to a broken external premise": a frequency, never a diagnosis. |
| `argus_amend` | Changes the predicate or check-by date **before** reality answers — a course change, not an erasure (the original stays on the append-only ledger). Hard-errors once the decision is settled. |
| `argus_dismiss` | Closes a decision **without settling** — it became irrelevant, was decided elsewhere, or you changed your mind. No verdict is recorded; terminal, not reopened. |
| `argus_check_in` | Returns contracts past their check-by date **and premise facts due for a re-check** (the same fact under several decisions is one re-check), and mirrors yesterday's watch anchor back as a question. If nothing is due, it says so and stops — it doesn't manufacture engagement. |
| `argus_sync` | Pulls your account receipts into the terminal (live judgments + what's due) so you can settle here. Seals push automatically; this is the read side. Requires `ARGUS_TOKEN`. |
| `argus_recall` | Reads your own history: a receipt, the open contracts, or a sample-size-caveated track record (never a tier or score). |
| `argus_init` / `argus_config` | Initialize the `.argus` directory; read/write non-spine settings. |

## Living premises

The receipt's sharpest line — `THE UNVERIFIED ASSUMPTION` — used to be written
once at seal and then go dead. Now it's a **tracked object**: name the premises
a decision rests on, correct the ones the model got wrong (your edit is part of
the record), and re-check the load-bearing external facts against reality while
the bet is still open. When a rate hike breaks the premise under three of your
decisions, that's **one** re-check, not three.

Honest limits, stated up front: an MCP server is passive — nothing wakes it
between seal and settle. The return loop rides four levers: every tool response
carries a quiet `due_note`; `argus_check_in` reports due premises;
the `argus://premises/due` resource lets hosts auto-inject them; and the
`/argus-settle` ritual includes the re-check choreography. Anything more
periodic (cron, reminders) belongs to your host or habits, not this server.
A premise that never gets re-checked shows up honestly as `never re-checked` —
Argus does not pretend liveness.

## Data

Everything is local, under `.argus/` in your project (gitignored by default) —
an append-only `ledger.jsonl` **you own**: plain JSON lines, no lock-in,
receipts render to shareable text. **No telemetry by default.** The only network
call Argus makes out of the box is the opt-in account sync: if — and only if —
you set `ARGUS_TOKEN`, a sealed/settled prediction is POSTed to your own Argus
account so it can email you at its check-by date. Separately, you can opt in to
**anonymous** usage telemetry with `ARGUS_TELEMETRY=1` (a random install id +
which tool ran + version/platform, never your decisions or token; honors
`DO_NOT_TRACK`) — see SECURITY.md. **Premise data stays on your machine
by default** — it is not part of the sync payload. There is exactly one switch
that changes this: `argus_config premise_sync:true` (off unless you set it)
sends a sealed decision's *monitored* premises along, so your account's
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

## Develop

```bash
npm install
npm run build
npm test          # deterministic spine + state-machine + path-safety gates
npx @modelcontextprotocol/inspector node dist/index.js
```

MIT licensed.
