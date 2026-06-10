# Argus (Plugin v2.1)

[**English**](./README.md) | [Korean](./README.ko.md)

**Decision-voyage harness for Claude Code.** Argus reads the repo, PR, file,
document, or decision context in your current workspace, checks the weak parts
behind the scenes, and returns one Current Bearing: where the decision stands,
why, what remains foggy, what path is not being taken, what to do next, and what
could later be checked against reality.

Argus is not a multi-agent dashboard. Agents are crew. The visible product is
orientation.

---

## What You Get

For low-density decisions, Argus returns a minimal scaffold and stops:

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

For important decisions, Argus does more work but keeps the terminal surface
compressed:

```text
## Argus - Current Bearing - v0.1

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

That is the plugin's default promise: not a long report, not a claim scoreboard,
not a visible agent parade. One usable bearing, with the voyage preserved in
files.

---

## When To Use

Good fits (code and non-code — Argus is a judgment harness, not only a code tool):

- "Should we migrate from Firestore to Supabase?"
- "Review PR #42 as a product, risk, and implementation decision."
- "Is our auth middleware design wrong?"
- "Should this feature live in the webapp or be absorbed into the plugin?"
- "Read this strategy doc and tell me the current course."
- "Should we expand to the EU market next quarter, or wait one?"
- "Should I take the senior IC offer or the management track?"
- "Which vendor should we pick for payments — and what would make that wrong?"

For non-code decisions, run Argus from any folder; you can paste the context or
reference a local document. (Richer business-artifact intake — decks, contracts —
is on the roadmap; today, paste the key facts.)

Bad fits:

- Syntax lookup or documentation search.
- Boilerplate code generation.
- Decisions you would comfortably make before lunch.
- Cases where you only want validation for an answer you already chose.

---

## Install

Argus is a Claude Code **plugin**. Install it through the plugin marketplace so
its commands are namespaced as `/argus:*` (this is what makes `/argus:sail`
work — see note below). In Claude Code:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Restart Claude Code. Then in any repo:

```text
/argus:sail "Your decision question here"
/argus:sail @PR#123
/argus:sail @docs/strategy.md
```

No setup is required. `.argus/config.yaml` auto-creates with sensible defaults.
By default `.argus/sessions/` is **git-ignored** (it can contain code diffs and
business context); opt into committing it to share decision history with your
team — see **Privacy & team sharing** below.

> **Why the marketplace, not a copy script?** Claude Code only applies the
> `argus:` namespace to commands from an installed plugin. Copying the skill
> folders into `~/.claude/skills/` (the old `install.sh` path) exposes them as
> bare `/sail`, `/team`, `/verify` … which collide with other skills and do
> **not** match the documented `/argus:*` names. Use the marketplace install above.

### Prerequisites

- **Claude Code** (latest).
- **git** — required for repo-aware analysis.
- **GitHub CLI (`gh`)** — *optional but recommended.* Needed for `@PR#N` /
  `@issue#N` auto-expansion; without it Argus asks you to paste the content.
- **Node.js ≥ 16** — *only* if you want the optional statusline.

### Platform

macOS, Linux, and Windows (Claude Code runs the skills). The optional
developer-mode helper script (`install.sh --link`, for live-editing skill files
against a local clone) is bash; on Windows run it from **Git Bash or WSL**.
Skill execution itself is cross-platform.

```bash
# Local development against a clone (bash / Git Bash / WSL):
./argus-plugin-v2/install.sh --link
node ./argus-plugin-v2/scripts/validate-plugin.js
node ./argus-plugin-v2/scripts/simulate-plugin.js
```

Restart Claude Code after editing skill files — skill bodies are cached at
session start.

---

## Internal Flow

Medium/high decisions use this hidden path:

```text
clarify -> crew work -> verify -> optional stakeholder review -> Current Bearing
```

Low-density decisions skip the full pipeline. Quick mode runs clarify only.

The default `/argus:sail` output hides:

- worker count,
- verification counts,
- schemas,
- model names,
- phase names,
- long workflow transcripts.

The details are still saved as JSON artifacts: clarify snapshot, worker results,
mix result, verification ledger, boss feedback, current bearing, final scaffold,
draft, and session metadata.

---

## Routing

| Question shape | Output | Why |
|---|---|---|
| Reversible single action with high framing confidence | MinimalScaffold | A full crew would be over-engineering. |
| Important or critical with confident stakes | Current Bearing | The first answer should orient the decision, not explain the workflow. |
| Borderline stakes | One `AskUserQuestion` gate | Human choice matters at the routing boundary. |
| Verification finds blockers | Hold, revise, or collect evidence | Argus refuses to hide unsupported claims inside polished language. |

Overrides:

- `/argus:sail --full "..."` forces the full pipeline.
- `/argus:sail --quick "..."` runs clarify only.
- `/argus:sail --no-boss "..."` keeps verification but skips stakeholder review.
- `/argus:sail --resume <session-id>` continues a paused session.

---

## Commands

`/argus:sail` orchestrates the flow and renders the Current Bearing.

`/argus:clarify` sharpens the destination and decides density/stakes.

`/argus:team` runs crew agents as workers on the actual artifact or decision.

`/argus:verify` performs positive and negative validation of crew output.

`/argus:boss` runs stakeholder review after verification.

`/argus:revise` applies boss concerns / verify challenges to a new child draft
and re-verifies — the iteration loop.

`/argus:chart` shows the version tree and session artifacts.

---

## What Makes It Different

1. **Current Bearing first.** The default product is orientation in one screen,
   not a workflow transcript.
2. **Crew, not panel critics.** Agents produce domain work on the actual
   problem behind the scenes.
3. **Verification before polish.** Supported, challenged, unresolved, and
   human-required claims are separated before the bearing is rendered.
4. **Road not taken is preserved.** A recommendation without an abandoned path is
   too easy to fake.
5. **Human choice gates are explicit.** When AI cannot verify something, Argus
   uses terminal-native `AskUserQuestion` instead of hiding uncertainty.
6. **Decision-contract seed.** Near anchor, Argus leaves a falsifiable predicate
   that can later be checked against reality.
7. **Git-native memory.** The voyage lives in `.argus/sessions/`, so the trail
   can be committed, shared, and reopened.

---

## Cost & run time

A `/argus:sail` run is not always cheap — it can spawn several agents. Rough
guide (varies with repo size and model):

| Path | Triggers | Time | Output tokens |
|---|---|---|---|
| Minimal scaffold | low-density reversible question | ~30s | small |
| `important` (default) | most decisions | ~3–5 min | ~40–80k |
| `critical` | irreversible / high-impact | ~6–10 min | ~100–180k |

On the full path, `sail` prints a one-line preview (agent count + rough time)
before it chains the team, so a "quick question" never silently turns into a
multi-minute, multi-agent run. `Ctrl-C` halts; `/argus:sail --resume <id>`
continues. If you're on a low API tier, prefer `--quick` or the minimal path.

## Privacy & team sharing

Argus's `.argus/` directory can contain code diffs, file contents, and your
problem text. Defaults are private-first:

- `.argus/sessions/` is **git-ignored by default.** Decision history stays local
  unless you opt in.
- Clarify/team **redact** likely secrets (`.env*`, `*.key`, private-key blocks,
  high-entropy strings) before sending diffs to the model or writing them to disk.
- To **share with your team**, set `archive.commit_sessions: true` in
  `.argus/config.yaml` and remove the `.argus/sessions/` ignore line — but review
  what you're committing first: session files (and the session directory name,
  which is derived from your question) include diffs and business context that
  will land in `git log` for everyone with repo access.

## Reference

- Final direction: `../docs/ARGUS-FINAL-DIRECTION.md`
- Agent roster: `data/agents.yaml`
- Boss MBTI personalities: `data/boss-types.yaml`
- Verification ledger schema: `data/schemas/verification-ledger.json`
- Current Bearing schema: `data/schemas/current-bearing.json`
- JSON schemas: `data/schemas/*.json`
- Version tree mechanics: `lib/session/version-numbering.md`
- Build status and decision log: `BUILD_STATUS.md`
- Simulation harness: `scripts/simulate-plugin.js`
