# Argus

[**English**](./README.md) | [한국어](./README.ko.md)

**Important decisions shouldn't end as answers. Argus keeps them alive as
courses until reality can answer.**

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
/argus:sail "The decision you're stuck on"        # after a restart
```

---

## Why Argus

AI assistants are very good at agreeing with you. Ask one whether your plan is
sound and you usually get a confident, polished **yes** — built on claims
nobody checked.

Argus is built to not do that. Before it answers, it sharpens what you're
really deciding, puts a small team of agents to work on your actual code,
PR, or document, and **verifies their claims** — separating what's supported
by evidence from what merely sounds plausible. Only then does it answer, in
one screen called a **Current Heading**: the current course, why, what's still
unverified, which alternative was set aside and why, and the next concrete
step.

Agents are crew, not the show. The product is orientation, not a workflow
report.

---

## What you get

Argus sizes its effort to the decision. A small, reversible question gets a
direct answer in about 30 seconds:

```text
/argus:sail "Should we rename Workspace to Project?"
```

```text
## Argus - Minimal - v0.1

Recommendation: Rename it to "Project". Zero user signal means low downside.
One check (<5 min): Any support tickets mentioning the old label? If 0, ship it.
Watch out: If users say "feels off" within 1 week, roll back.

density: low - team, verification, and boss skipped
Force full pipeline: /argus:sail --full "..."
```

A consequential question gets the full pipeline — but the output stays one
screen:

```text
## Argus - Current Heading - v0.1

Current course: run a 4-hour migration spike before deciding on consolidation.

Why this course:
- The product-identity upside is real, but cost savings alone do not justify the move.
- The plugin/webapp depth gap is still unproven from usage data.

Fog / reef: "plugin Boss can match webapp depth in 6 months" has no evidence yet.
Why it matters: that claim would make the migration look safer than it is.
Required check: pull DAU split by surface.

Road not taken: full consolidation now - it spends migration cost before proving demand.

Next helm: pull DAU split, then run the spike.

Contract seed: if plugin DAU is below X after 30 days, do not absorb the webapp path.
Check by: 30 days after plugin release.

Details: .argus/sessions/2026-04-29-boss-absorption/versions/v0.1/
```

Reading the card, top to bottom: **where you're headed** (current course),
**the evidence for it**, **the riskiest unverified claim** (fog/reef), **the
alternative you're consciously not taking**, **the next concrete action**
(next helm), and **a prediction you can later check against reality**
(contract seed). The full reasoning — every agent's work, every verified and
challenged claim — is preserved on disk under `.argus/sessions/`.

---

## When to use it

Argus is a judgment tool, not just a code tool. Good fits:

- "Should we migrate from Firestore to Supabase?"
- "Review PR #42 as a product, risk, and implementation decision."
- "Is our auth middleware design wrong?"
- "Read this strategy doc and tell me the current course."
- "Should we expand to the EU market next quarter, or wait one?"
- "Should I take the senior IC offer or the management track?"
- "Which payment vendor should we pick — and what would make that wrong?"

For non-code decisions, run it from any folder and paste the key facts or
point it at a local document.

Not a good fit:

- Syntax lookup, documentation search, boilerplate generation.
- Decisions you'd comfortably make before lunch.
- When you only want validation for an answer you've already chosen —
  Argus will push back, and that's by design.

---

## Install

In Claude Code:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Restart Claude Code, then in any project:

```text
/argus:sail "Your decision question"
/argus:sail "Is PR 123 safe to merge?"
/argus:sail "Is docs/strategy.md taking us the right way?"
```

Just say it — quotes optional, no syntax to learn. When your question names a
PR, issue, file, branch, or document, Argus reads that artifact and works on
it. You can even skip the command: asking Claude "review this deck before I
send it" or "should we ship this?" triggers Argus on its own. Documents
supported: pdf/md/txt read directly; **pptx/docx/hwpx** extracted
dependency-free; xlsx and legacy .ppt/.doc/.hwp → Argus asks for a CSV/PDF
export instead of guessing. Explicit `@PR#123` / `@doc:<path>` forms exist if
prose is ambiguous.

**Zero setup.** Everything ships inside the plugin. Your first session after
installing greets you with a one-line pointer to `/argus:help` (once, ever —
Argus stays silent otherwise). On first run Argus auto-creates
`.argus/config.yaml` with sensible defaults (language is auto-detected; edit
the file to change it or to pick a different stakeholder persona). Session
history is **git-ignored by default** — see
[Privacy](#privacy--team-sharing).

### Requirements

| Requirement | Needed for |
|---|---|
| Claude Code (latest) | everything |
| `git` | repo-aware analysis (optional for non-code decisions) |
| GitHub CLI `gh` | optional — fetching PRs/issues you mention; without it, paste the content |
| Node.js ≥ 16 | optional — statusline and the contract-reminder hook |

Works on macOS, Linux, and Windows.

---

## Commands

| Command | What it does |
|---|---|
| `/argus:sail` | **Start here.** Runs the whole flow and renders the Current Heading. |
| `/argus:help` | Command map; tells you which command fits your situation. |
| `/argus:chart` | Where am I in this voyage? Version tree, open checks, next step. Also promote/branch. |
| `/argus:log` | Voyage log across all sessions: past decisions, sealed contracts, your prediction record. `--insights` adds pattern notes once ≥3 contracts are settled; `--all` lists every session. |
| `/argus:settle` | Check predictions whose date arrived against reality; builds your calibration history. |
| `/argus:revise` | Apply review feedback into a new draft and re-verify — the iteration loop. |
| `/argus:clarify` | Sharpen the real question before any work (sail runs this first). |
| `/argus:team` | Put the agent crew to work on the artifact (sail chains this). |
| `/argus:verify` | Split crew claims into supported / challenged / human-required (sail chains this). |
| `/argus:boss` | Stakeholder pressure-check in a configurable persona (sail chains this). |
| `/argus:helm` | *Experimental.* Silent pre-approval scan of an agent plan; speaks only when an unverified claim props up an irreversible action. |

Flags for `sail`:

| Flag | Effect |
|---|---|
| `--quick` | Sharpen the question only; no pipeline. |
| `--full` | Force the full pipeline even for a small question. |
| `--no-boss` | Keep verification, skip the stakeholder review. |
| `--resume <session-id>` | Continue a paused or blocked session. |

---

## How it works

For consequential decisions, sail runs this pipeline behind the scenes:

```text
clarify ──→ crew work ──→ verify ──→ stakeholder review ──→ Current Heading
(real        (agents work    (claims:      (optional,           (one screen)
 question)    the artifact)   supported /   persona-based)
                              challenged /
                              human-required)
```

Three properties worth knowing:

- **Verification is a gate, not decoration.** If a critical claim has no
  evidence, the bearing says *hold* or *collect evidence* — it will not hide
  an unverified claim inside polished language. When only a human can check
  something, Argus asks you directly instead of guessing.
- **Disagreement is preserved.** When agents genuinely conflict, the card
  shows the tension and what would resolve it, instead of averaging it away.
- **The machinery stays hidden.** Agent counts, schemas, and phase names never
  appear in the default output. The full trail is in
  `.argus/sessions/<id>/` and `/argus:chart` when you want it.

### The settlement loop

A Current Heading close to a final decision ends with a **contract seed**: a
falsifiable prediction with a check-by date ("if plugin DAU is below X after
30 days, do not absorb the webapp path"). The loop then closes itself:

1. A quiet session-start hook prints **one line** when a contract in the
   current project is past its check-by date — and nothing otherwise.
   Disable anytime via `/hooks`.
2. `/argus:settle` asks what reality did (held / missed / partial / push the
   date) and records it in an append-only ledger.
3. `/argus:log` shows the running record — and once enough contracts are
   settled, new voyages quietly take your track record into account when
   surfacing hidden assumptions.

This is the part that compounds: over time `.argus/` becomes a record of what
you decided, what you predicted, and how often you were right — a history no
fresh tool can give you back.

---

## Cost & run time

A full run spawns several agents — it is not free. Sail prints a one-line
time preview before any multi-agent work starts, so a quick question never
silently becomes a 10-minute run. `Ctrl-C` halts; `--resume` continues.

| Path | When | Time | Output tokens |
|---|---|---|---|
| Minimal | small reversible question | ~1 min | small |
| Standard (default) | most decisions | ~4–8 min | ~40–80k |
| Critical | irreversible / high-impact | ~8–12 min | ~100–180k |

On a tight API budget, prefer `--quick`.

---

## Privacy & team sharing

`.argus/` can contain code diffs, file contents, and your problem text.
Defaults are private-first:

- `.argus/sessions/` is **git-ignored by default** — decision history stays
  local unless you opt in.
- Likely secrets (`.env*`, `*.key`, private-key blocks, high-entropy strings)
  are **instructed to be redacted** before diffs reach the model or disk — a
  prompt-rule mitigation, not a mechanical guarantee; in a secrets-heavy repo,
  inspect session files before committing them anywhere.
- To share decision history with your team: set
  `archive.commit_sessions: true` in `.argus/config.yaml` and remove the
  ignore line — but review what you commit first; session files (and session
  directory names, which derive from your question) carry business context
  into `git log` for everyone with repo access.

---

## Development

```bash
# Live-edit against a local clone (bash / Git Bash / WSL):
./argus-plugin-v2/install.sh --link
node ./argus-plugin-v2/scripts/validate-plugin.js   # structure + contract checks
node ./argus-plugin-v2/scripts/simulate-plugin.js   # output-quality gates
```

Restart Claude Code after editing skill files — skill bodies are cached at
session start. Note: the copy install exposes commands *without* the
`argus:` namespace (`/sail`, `/team`, …) and can collide with other skills;
the marketplace install above is the supported path.

## Reference

- Changelog: `CHANGELOG.md`
- Agent roster: `data/agents.yaml` · Boss personas: `data/boss-types.yaml`
- Schemas: `data/schemas/*.json` (Current Heading: `current-bearing.json`,
  verification ledger: `verification-ledger.json`)
- Version-tree mechanics: `lib/session/version-numbering.md`
- Design direction: `../docs/ARGUS-FINAL-DIRECTION.md` ·
  Build log: `BUILD_STATUS.md` · Test plan: `TEST_PLAN.md`

## License

MIT
