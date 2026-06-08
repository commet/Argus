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

Good fits:

- "Should we migrate from Firestore to Supabase?"
- "Review PR #42 as a product, risk, and implementation decision."
- "Is our auth middleware design wrong?"
- "Should this feature live in the webapp or be absorbed into the plugin?"

Bad fits:

- Syntax lookup or documentation search.
- Boilerplate code generation.
- Decisions you would comfortably make before lunch.
- Cases where you already know the answer and only want validation. Argus is
  built to preserve disagreement.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

Restart Claude Code. Then in any repo:

```text
/argus:sail "Your decision question here"
```

No setup is required. `.argus/config.yaml` auto-creates with sensible defaults
and `.argus/sessions/` stores decision history in the repo so it can travel with
git.

For local development:

```bash
./argus-plugin-v2/install.sh --link
```

Restart Claude Code after editing skill files. Skill bodies are cached at
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

## Reference

- Agent roster: `data/agents.yaml`
- Boss MBTI personalities: `data/boss-types.yaml`
- Verification ledger schema: `data/schemas/verification-ledger.json`
- JSON schemas: `data/schemas/*.json`
- Version tree mechanics: `lib/session/version-numbering.md`
- Build status and decision log: `BUILD_STATUS.md`
- Webapp: [argus.voyage](https://argus.voyage)
- License: MIT
