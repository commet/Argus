# Argus (Plugin v2.1)

[**English**](./README.md) | [Korean](./README.ko.md)

**Verification-first judgment harness for Claude Code.** Argus does not exist to
generate code or praise a plan. It clarifies the real decision, deploys an agent
team as workers, then verifies their output into supported, challenged,
unresolved, and human-required claims before a decision scaffold is shown.

---

## What You Get

Most decisions are reversible and do not need a 30-minute team review. Type:

```text
/argus:sail "Should we rename Workspace to Project?"
```

For low-density decisions, Argus returns a minimal scaffold:

```text
## Argus - Minimal - v0.1

Recommendation: Rename it to "Project". Zero user signal means low downside.
One check (<5 min): Any support tickets mentioning the old label? If 0, ship it.
Watch out: If users say "feels off" within 1 week, roll back.

density: low - team, verification, and boss skipped
Force full pipeline: /argus:sail --full "..."
```

For important or critical decisions, Argus runs the full chain:

```text
clarify -> team -> verify -> boss -> final decision card
```

The important change in v2.1 is `verify`: agent output is no longer promoted
straight to a final card. Argus first checks what is actually supported, what is
weak or contradicted, what remains unresolved, and what a human must verify.

---

## Case Study

> **Question:** "Should we ship to EU this quarter or wait one quarter? GDPR is
> 70% ready."

```text
clarify: critical stakes, framing confidence 76 - asks user to confirm
team: deploys 4 workers - research, scenario, legal, risk
verify: 5 supported claims, 2 challenged claims, 3 human-required checks
boss: cannot approve until external GDPR advisor checkpoint is cleared
```

Final card shows:

- **Supported claim:** EU demand exists, but only from partial pipeline signals.
- **Challenged claim:** "70% GDPR ready is shippable" is not supported without
  external counsel.
- **Unresolved tension:** launch timing advantage vs compliance blast radius.
- **Human-required checkpoint:** ask EU GDPR advisor whether the current gap is
  launch-blocking.
- **Tie-break condition:** if counsel says "not launch-blocking", ship with kill
  criteria; otherwise wait one quarter.

This is the product identity: Argus does not replace the human decision. It
reduces the chance that an AI team confidently hands you an unverified answer.

---

## When To Use

Good fits (code and non-code — Argus is a judgment harness, not only a code tool):

- "Should we migrate from Firestore to Supabase?"
- "Review PR #42 as a product, risk, and implementation decision."
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
- Cases where you already know the answer and only want validation. Argus is
  built to preserve disagreement.

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
```

Restart Claude Code after editing skill files — skill bodies are cached at
session start.

---

## Full Decision Card

When `clarify` decides the question is important or critical, `sail`
auto-chains the full pipeline and prints a compact card:

```text
## Argus - 2026-04-29-boss-absorption - v0.1

Question: Are the two surfaces' user bases separate enough to justify
          maintaining duplicate Boss code?

Verification: mixed - 4 supported, 2 challenged, 1 human check
Top challenge: Plugin Boss can match webapp depth within 6 months is unproven.

Boss (ISTJ Park): Proceed only after a 4-hour migration spike and rollback
                  kill criteria are defined.

Top action this week: Pull DAU split by surface - run 4-hour migration spike.

Doubtful assumption: Plugin users and webapp users have the same Boss needs.

Unresolved tension: Cost saving is small, but product positioning may justify
                    consolidation.

Human-required: Confirm DAU ratio. Only you can see this data.

.argus/sessions/2026-04-29-boss-absorption/versions/v0.1/
Full tree: /argus:chart
```

Behind it are JSON artifacts preserving the work: clarify snapshot, worker
results, mix result, verification ledger, boss feedback, final scaffold, draft,
and session metadata.

---

## Routing

`/argus:sail "..."` routes by `decision_density` and `stakes_confidence`:

| Question shape | Output | Why |
|---|---|---|
| Reversible single action with high framing confidence | MinimalScaffold, no team | A full team would be over-engineering. |
| Important or critical with confident stakes | `team -> verify -> boss` | The first answer should include checked disagreement, not raw agent output. |
| Borderline stakes | One `AskUserQuestion` gate | Human choice matters at the routing boundary. |
| Verification finds blockers | Human choice or team revision | The plugin refuses to hide unsupported claims inside a polished card. |

Overrides:

- `/argus:sail --full "..."` forces full pipeline.
- `/argus:sail --quick "..."` runs clarify only.
- `/argus:sail --no-boss "..."` keeps verification but skips stakeholder review.
- `/argus:sail --resume <session-id>` continues a paused session.

---

## Commands

`/argus:sail` orchestrates the full flow.

`/argus:clarify` sharpens the question and decides density/stakes.

`/argus:team` deploys 2-4 worker agents on the actual artifact or decision.

`/argus:verify` performs positive and negative validation of team output.

`/argus:boss` runs stakeholder review after verification.

`/argus:chart` shows the version tree and session artifacts.

---

## What Makes It Different

1. **Workers, not panel critics.** Agents produce domain work on the real
   problem. Critique is not the whole interaction.
2. **Verification before polish.** Supported claims, challenged claims, unresolved
   tensions, and human-required checks are separated before the final card.
3. **Contradictions are preserved.** Agent disagreement is not averaged away.
4. **Human choice gates are explicit.** When AI cannot verify something, Argus
   uses Claude Code's terminal-native `AskUserQuestion` flow instead of hiding
   uncertainty.
5. **Decision scaffold, not solution theater.** The output tells you what you
   are deciding, what is known, what is weak, and what must happen next.

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

- Agent roster: `data/agents.yaml`
- Boss MBTI personalities: `data/boss-types.yaml`
- Verification ledger schema: `data/schemas/verification-ledger.json`
- JSON schemas: `data/schemas/*.json`
- Version tree mechanics: `lib/session/version-numbering.md`
- Build status and decision log: `BUILD_STATUS.md`
- Webapp: [argus.voyage](https://argus.voyage)
- License: MIT
