# Argus (Plugin v2)

[**English**](./README.md) · [한국어](./README.ko.md)

**Judgment harness for Claude Code.** A team of agents helps you structure decisions inside your actual codebase — not generate code, not review PRs, **decide**.

---

## What you get in one screen

Most decisions are reversible and don't need a 30-minute team review. Type `/argus:sail "your question"` and get this:

```
## Argus · Minimal · v0.1

Recommendation: Just rename it to '작업실'. Zero user signal = zero downside.
One check (<5 min): Any support tickets mentioning the old label? 0 = ship it.
Watch out: If users say "feels off" within 1 week of release, roll back.

─────
density: low (reversible UI label) · team & boss skipped
Force full pipeline: /argus:sail --full "..."
```

That's the entire output for a routine reversible call. **No team. No JSON. ~30 seconds.**

When the question is meatier, you get a 15-line decision card preserving the trade-offs and disagreements that came up. (See § "The other shape" below.)

---

## A real decision flow (case study)

> **Question:** *"Should we ship to EU this quarter or wait one quarter? GDPR 70% ready."*

```
→ clarify: critical stakes, framing confidence 76 → asks user to confirm
→ team deploys 4: Sophie (research) · Victor (scenario) · Arthur (legal) · Blake (risk)
→ stage-1 surfaces a ship-or-halt conflict between Arthur ↔ Victor → debate.json written
→ Boss (ISTJ) reviews: "1 unresolved tension + 2 critical concerns —
                        can't approve without external advisor"
```

Final card shows:
- **Unresolved tension preserved**: *"Victor: kill criteria reached. Arthur: GDPR fine risk."*
- **Tie-breaking condition**: *"if external EU GDPR advisor says '70% shippable', Victor wins"*
- **3 user-required checkpoints**: contact advisor · measure EU DAU · verify competitor timeline

User contacts the advisor. Comes back the next week, runs `/argus:sail --resume <session>`. v0.2 produced reflecting the new info. Ship goes ahead — but now with documented kill criteria and a kept record of who-said-what for the team to read later in `git`.

This is what `team_contradictions[]` + `human_required_checkpoints[]` look like in practice. Not a verdict — a structure you can act on.

---

## When to use vs not use

**Good fits**
- "Should we migrate from Firestore to Supabase?" — multi-stakeholder, hard to undo, you want trade-offs surfaced
- "Review my PR #42" — code-native, real artifact for agents to work on
- "Is our auth middleware design wrong?" — needs technical + risk + UX angles together
- "Boss feature: leave in webapp or absorb into plugin?" — product strategy with frame conflict

**Bad fits (use ChatGPT or just decide)**
- "What's the syntax for X?" — Cursor or docs are faster
- "Write me boilerplate for Y" — code generation, not judgment
- Anything you'd commit before lunch with no team consultation
- Decisions where you already know the answer and want validation — Argus preserves disagreement; that's not what you want here

---

## Install (30 seconds)

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

Restart Claude Code. Then in any repo:

```
/argus:sail "Your decision question here"
```

No setup needed. `.argus/config.yaml` auto-creates with sensible defaults (ISTJ stakeholder boss, locale auto-detected from `$LANG`). Edit later if you want a different boss persona.

---

## The other shape: full decision card

When clarify decides your question is genuinely meaty (important/critical stakes, multiple frames in tension), sail auto-chains: clarify → 3-4 agents in parallel → boss review → consolidated card. You see brief progress lines between steps, then this:

```
## Argus · 2026-04-29-boss-absorption · v0.1

Question: Are the two surfaces' user bases separate enough to justify
          maintaining duplicate Boss code?

Boss (ISTJ Park): Approve once you (1) spike 4hr migration sizing
                  and (2) define rollback kill criteria.

Top action this week: Pull DAU split by surface · 4hr migration spike

⚠ Doubtful assumption: Plugin Boss can match webapp depth (16 MBTI,
  deep mode, mass consultation) within 6 months.

⚠ Unresolved tension (1): Cost saving ($1,520/6mo) is small —
  positioning argument vs raw $ argument.

👤 Human-required (3): Confirm DAU ratio (only you can see it)

📁 .argus/sessions/2026-04-29-boss-absorption/versions/v0.1/
🗺  Full tree: /argus:chart
```

Behind it: 5 JSON files preserving every agent's voice + the debate that surfaced. Open them via `/argus:chart` when you want depth.

---

## How sail routes

`/argus:sail "..."` doesn't always run the full pipeline. It auto-routes by `decision_density` and `stakes_confidence` — both produced by clarify in seconds:

| Your question shape | Output | Why |
|---|---|---|
| Reversible single-action (rename, label, toggle) with high framing confidence | **MinimalScaffold** — 3 lines: recommendation + 1 quick check + optional caveat. No team, no boss. | A 5-section scaffold for a tab-rename is over-engineering. |
| Important/critical question with confident stakes (≥80) | Auto-chains team → boss → ~15-line consolidated card. One-line progress notices between steps. | Asking "what should I run?" when stakes are obvious wastes your first input. |
| Borderline stakes (clarify confidence 60–79) | One AskUserQuestion: "I read this as X stakes (N/100) — right?" → auto-proceeds. | User agency where it matters; not where it doesn't. |
| Anything else | Standard 4-option dialog (full / team-only / quick / pause). | Last-resort fallback. |

**Override paths**
- `/argus:sail --full "..."` — force full pipeline regardless of density
- `/argus:sail --quick "..."` — clarify only, regular scaffold (no MinimalScaffold collapse)
- `/argus:sail --no-boss "..."` — skip boss review at the end
- `/argus:sail --resume <session-id>` — continue a paused session

---

## Configuration

First run: zero setup. `.argus/config.yaml` auto-created on first `/argus:sail`. Sensible defaults (ISTJ default boss). Edit only if you want different MBTI / locale / role label:

```yaml
boss:
  mbti_code: ISTJ        # ISTJ ISFJ INFJ INTJ ISTP ISFP INFP INTP
                         # ESTP ESFP ENFP ENTP ESTJ ESFJ ENFJ ENTJ
  name: "Park"
  gender: male           # male | female (EN) or 남 | 여 (KR)
  role: "Team Lead"
locale: en               # en | ko
```

Per-repo. Commits with your code. Sessions in `.argus/sessions/` ship with the repo, so teams share decision history via git.

**Dev mode** (symlink install via `--link`): edit skill `.md` files → restart Claude Code to apply. Skill bodies cache at session start; symlinked file changes don't take effect mid-session.

---

## What's behind the scenes

`/argus:sail` orchestrates four sub-skills:
- `/argus:clarify` — sharpen the question (often emits the answer for low-density)
- `/argus:team` — deploy 2–4 agents as workers on the actual artifact
- `/argus:boss` — your stakeholder reviews (one of 16 MBTI personas)
- `/argus:chart` — version tree view + draft management

**The 17-agent team** auto-selects 2–4 per session based on task type. Each agent has a distinct voice (research / strategy / numbers / UX / legal / risk / etc.). Critical-stakes decisions add a mandatory risk reviewer (Blake) for stage-2 critique.

**Three properties make this different from Cursor / Copilot Review / ChatGPT:**
1. **Workers, not critics.** Agents produce domain artifacts (research notes, ROI tables, UX critiques) on the real problem. Critique is one separate step (boss review), not the whole interaction.
2. **Contradictions preserved.** When agents disagree on critical-stakes decisions, the disagreement is stored in the scaffold's `team_contradictions[]`, never averaged away. You see the tension; you resolve it.
3. **Decision scaffold, not solution.** Output shape: `reframed_question` + `key_trade_offs[]` + `hidden_assumptions[]` + `human_required_checkpoints[]`. The plugin refuses to tell you what to do; it tells you what you're deciding.

---

## Reference

- Full agent roster — `data/agents.yaml`
- Boss MBTI personalities — `data/boss-types.yaml`
- JSON schemas — `data/schemas/*.json` (analysis-snapshot, minimal-scaffold, final-scaffold, draft, session, etc.)
- Version tree mechanics — `lib/session/version-numbering.md`
- Build status, decision log, fix history — `BUILD_STATUS.md`
- **Webapp** — [argus.voyage](https://argus.voyage) (Next.js with richer UI). Plugin shares agent identities + MBTI archetypes + draft tree model. Plugin diverges on output shape (scaffold vs markdown), agent role (workers vs reviewers), environment (code-native vs prose), and persistence (filesystem vs Supabase).
- **License** — MIT
