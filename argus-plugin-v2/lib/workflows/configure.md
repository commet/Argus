---
name: configure
user-invocable: false
description: Configure this repo's Argus language, stakeholder persona, and archive preference. Invoked through `/argus:settings configure`.
allowed-tools: Read, Write, AskUserQuestion
---

# Internal configure workflow

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
- **`boss`** *(optional block)* — the stakeholder the boss step (`/argus:review`)
  pressure-checks against, defined SEAT-FIRST (R42 — the seat is the value, not a
  personality type): `role` (the chair, default `팀장` / `Team Lead`), `owns`
  (what the seat is accountable for — the highest-value field), `goals` (current
  priorities), `authority` (what they can approve/refuse vs must escalate),
  `name`, `gender` (`남`/`여` or `male`/`female`), and an optional voice skin
  `tone` (one of the 16 presets in `data/boss-types.yaml`; legacy key
  `mbti_code` still works and means the same thing — tone only).
- **`archive.commit_sessions`** — `true`/`false`. Whether `/argus:history versions` offers to
  git-commit `.argus/sessions/` when a decision completes. Default `false`.
- **`team`** *(optional, advanced)* — `max_agents_override` (1–6), `preferred_agents`
  (ids). Only touch if the user explicitly asks; otherwise leave it out.

## Flow

### Step 0 — read current state
Read `.argus/config.yaml`.
- **Missing** → run **First-time setup**. (`/argus:review` also auto-creates the file
  with a detected locale; this skill is the explicit, interactive path.)
- **Exists** → run **Returning-user update**: show the current values, change what
  they ask for, keep the rest.

### First-time setup — ≤ 3 asks, every one skippable

**Ask 1 · Language** — `AskUserQuestion`: 한국어 / English. → `locale`. (If the user's
language is obvious, offer the detected one first.)

**Ask 2 · Boss (stakeholder seat)?** — "Set up the stakeholder Argus
pressure-checks your decisions against in the boss step of `/argus:review`?
You can skip — a generic decision-owner review is used."
- **Yes** → gather the SEAT in ONE compact turn (one message, not six prompts —
  every field but `role` is skippable):
  - `role` — the chair they sit in; default `팀장` (ko) / `Team Lead` (en).
  - `owns` — "그분이 책임지는 것을 한 줄로 적어주세요. (예: 팀 로드맵과 서비스 안정성)" —
    the single highest-value answer; encourage but never require.
  - `goals` — "요즘 그분의 최우선 목표는?" (one line).
  - `authority` — "그분이 직접 승인/반려할 수 있는 범위는? 위로 올려야 하는 건?"
  - `name` / `gender` — free text / `남`·`여` (`male`/`female`).
  - `tone` *(optional, LAST, low-key)* — "말투 느낌을 정할까요? 아는 MBTI 코드가
    있으면 적어주세요 (예: ISTJ). 없으면 넘어가도 됩니다 — 말투일 뿐, 리뷰
    내용에는 영향이 없습니다." Do NOT quiz the user into a type (the old
    two-question mapper was personality theater — retired in O3 방3).
- **Skip** → omit the entire `boss:` block (don't write an empty one).

**Ask 3 · Commit session files?** — "When a decision ends, should `/argus:history versions` offer
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
  name: "박 팀장"
  role: "팀장"
  owns: "팀 분기 로드맵과 서비스 안정성"
  goals: "이번 분기 신뢰성 사고 0건, 일정 준수"
  authority: "머지·배포 승인과 일정 조정. 예산·인사는 상신."
  gender: 남
  tone: ISTJ
archive:
  commit_sessions: false
```

Omit optional blocks the user skipped. Keep `locale` always present (it's required).

### Confirm
One short screen — the saved values + the path — then point onward:

```text
✓ Saved to .argus/config.yaml
  language        한국어
  boss            박 팀장 · 팀장 · 소유: 서비스 안정성   (omit line if skipped; never print the tone code)
  commit sessions off

Try: /argus:review "<a real decision you're weighing>"
```

## Forbidden patterns
- Inventing schema fields the skills don't read (presets, journal, output_format,
  rehearse, pipeline). The schema is exactly: `locale`, `boss`, `team`, `archive`.
- Writing `.argus/config.json` — the config is **YAML** (`.argus/config.yaml`).
- Requiring configuration before Argus will run — it is always optional.
- Overwriting unrelated existing keys on save (read-modify-write).
- Box-drawing characters or a multi-screen wizard — keep it to ≤ 3 asks.
