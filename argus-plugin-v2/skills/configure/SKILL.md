---
name: configure
description: Set up or change Argus's saved preferences for THIS repo — language and your stakeholder (Boss) persona — written to .argus/config.yaml. Use when the user wants to set or change the language, configure the Boss that /argus:boss role-plays, decide whether voyage session files get committed, or asks "how do I configure Argus / change settings". Interactive and entirely optional — Argus works with sensible defaults if it's never run. Invoked as `/argus:configure`.
allowed-tools: Read, Write, AskUserQuestion
---

# /argus:configure

Sets `.argus/config.yaml` — the per-repo preferences every Argus skill reads at
startup. **Optional**: skills fall back to sensible defaults (auto-detected locale,
a generic Boss, no session commits) when it's absent. This skill just makes those
choices explicit and persistent, in one short exchange.

Respond in `config.locale` if the file already sets one; otherwise match the user's
language. **No box-drawing characters** (`╭ ┌ │ ═ ━ …`) — structure with `---`,
**bold**, and whitespace.

## What it can set (the WHOLE schema — never more)

This is the complete `data/schemas/config.json`. Do **not** invent fields the skills
don't actually read (no presets / journal / pipeline / output-format keys — those
were a stale design and are gone):

- **`locale`** — `ko` | `en`. Language for prompts, AskUserQuestion options, and
  generated output. *(required)*
- **`boss`** *(optional block)* — the stakeholder `/argus:boss` pressure-checks
  against: `mbti_code` (one of the 16 in `data/boss-types.yaml`), `name`, `gender`
  (`남`/`여` or `male`/`female`), `role` (free text, default `팀장` / `Team Lead`).
- **`archive.commit_sessions`** — `true`/`false`. Whether `/argus:versions` offers to
  git-commit `.argus/sessions/` when a voyage completes. Default `false`.
- **`team`** *(optional, advanced)* — `max_agents_override` (1–6), `preferred_agents`
  (ids). Only touch if the user explicitly asks; otherwise leave it out.

## Flow

### Step 0 — read current state
Read `.argus/config.yaml`.
- **Missing** → run **First-time setup**. (`/argus:sail` also auto-creates the file
  with a detected locale; this skill is the explicit, interactive path.)
- **Exists** → run **Returning-user update**: show the current values, change what
  they ask for, keep the rest.

### First-time setup — ≤ 3 asks, every one skippable

**Ask 1 · Language** — `AskUserQuestion`: 한국어 / English. → `locale`. (If the user's
language is obvious, offer the detected one first.)

**Ask 2 · Boss persona?** — "Set up the stakeholder Argus pressure-checks your
decisions against in `/argus:boss`? You can skip — a generic reviewer is used."
- **Yes** → gather in ONE compact turn (one message, not four prompts):
  - `name` — free text (e.g. `박 팀장`, `Alex`).
  - `role` — free text; default `팀장` (ko) / `Team Lead` (en).
  - `gender` — `남`/`여` (ko) or `male`/`female` (en).
  - `mbti_code` — ask for the 4-letter code if they know it. If they don't, ask two
    quick either/or questions (decisive vs. consensus-seeking; detail/process vs.
    big-picture) and map to one of the 16. It **must** be a real code from
    `data/boss-types.yaml` (ISTJ … ENTJ).
- **Skip** → omit the entire `boss:` block (don't write an empty one).

**Ask 3 · Commit session files?** — "When a voyage ends, should `/argus:versions` offer
to git-commit `.argus/sessions/`? Default no — they're git-ignored." →
`archive.commit_sessions`.

### Returning-user update
Print the current config as a short list (locale, boss name/role if set, session
commits on/off). Then `AskUserQuestion`: **change language · change boss · toggle
session-commit · reset to defaults · done**. Allow several edits before saving.

### Save
Write `.argus/config.yaml` as YAML that validates against the schema. **Preserve any
existing keys you didn't touch** (read-modify-write — never clobber a `team:` block
the user hand-added). Shape:

```yaml
locale: ko
boss:
  mbti_code: ISTJ
  name: "박 팀장"
  gender: 남
  role: "팀장"
archive:
  commit_sessions: false
```

Omit optional blocks the user skipped. Keep `locale` always present (it's required).

### Confirm
One short screen — the saved values + the path — then point onward:

```text
✓ Saved to .argus/config.yaml
  language        한국어
  boss            박 팀장 · 팀장 · ISTJ      (omit line if skipped)
  commit sessions off

Try: /argus:sail "<a real decision you're weighing>"
```

## Forbidden patterns
- Inventing schema fields the skills don't read (presets, journal, output_format,
  rehearse, pipeline). The schema is exactly: `locale`, `boss`, `team`, `archive`.
- Writing `.argus/config.json` — the config is **YAML** (`.argus/config.yaml`).
- Requiring configuration before Argus will run — it is always optional.
- Overwriting unrelated existing keys on save (read-modify-write).
- Box-drawing characters or a multi-screen wizard — keep it to ≤ 3 asks.
