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

Good fits:

- "Should we migrate from Firestore to Supabase?"
- "Review PR #42 as a product, risk, and implementation decision."
- "Is our auth middleware design wrong?"
- "Should this feature live in the webapp or be absorbed into the plugin?"
- "Read this strategy doc and tell me the current course."

Bad fits:

- Syntax lookup or documentation search.
- Boilerplate code generation.
- Decisions you would comfortably make before lunch.
- Cases where you only want validation for an answer you already chose.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

Restart Claude Code. Then in any repo:

```text
/argus:sail "Your decision question here"
/argus:sail @PR#123
/argus:sail @docs/strategy.md
```

No setup is required. `.argus/config.yaml` auto-creates with sensible defaults.
`.argus/sessions/` stores decision history in the repo so it can travel with git.

For local development:

```bash
./argus-plugin-v2/install.sh --link
node ./argus-plugin-v2/scripts/validate-plugin.js
node ./argus-plugin-v2/scripts/simulate-plugin.js
```

Restart Claude Code after editing skill files. Skill bodies are cached at
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

`/argus:revise` creates a child draft after verification, boss feedback, or a
user repair directive.

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
