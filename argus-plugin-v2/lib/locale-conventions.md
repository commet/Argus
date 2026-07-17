# Locale Conventions

Every skill honors `config.locale` from `.argus/config.yaml`.

**Resolution order (L3.3 — must stay consistent with sail Step 0, which owns
first-run detection and never asks setup questions):**
1. `config.locale` if present — authoritative.
2. Config missing → sail Step 0 detects ONCE and writes the result into the
   auto-created config (first match wins): `LANG`/`LC_ALL` starts with `ko` →
   ko; on Windows, system UI culture is `ko-*` → ko; the user's problem text is
   predominantly Hangul → ko; else → en.
3. The detection is silent — no "Korean or English?" prompt on first run
   (first-run friction was the discoverability killer). If the detected value
   is wrong, the fix is one edit: `locale:` in `.argus/config.yaml`; every
   skill re-reads it on its next invocation.

## Affected surfaces

All of these MUST switch on `config.locale`:

1. **AskUserQuestion** — title, question text, option labels
2. **User-facing print output** — status reports, error messages, confirmation dialogs
3. **LLM system prompts** — tone rules, example formatting instructions
4. **Generated artifact field content** — `first_reaction`, `good_parts[]`, etc. in the output locale

NOT switched on locale (always stays same):
- Field NAMES in JSON artifacts (`real_question`, `hidden_assumptions`, `first_reaction`, etc.)
- Agent `id`s and canonical names in `data/agents.yaml`
- MBTI codes
- Version labels (`v0.1`, `v1.0`, etc.)
- File paths

## Option pattern

For AskUserQuestion with binary choices:

| Situation | ko | en |
|-----------|-----|-----|
| Accept | "네" / "맞아요" / "진행" | "Yes" / "Proceed" |
| Reject | "아니오" / "취소" / "다시" | "No" / "Cancel" / "Redo" |
| Later | "나중에" / "생략" | "Later" / "Skip" |
| Free input | "직접 입력" / "다른 의견" | "Let me type it" / "Other" |

## Bilingual boss types

Tone-skin `example_dialogue` entries in `data/boss-types.yaml` are Korean-only. This is **intentional**: the preset's rhythm is modeled on Korean workplace culture. For locale=en, the boss prompt keeps the structural voice fields (communicationStyle, feedbackStyle, bossVibe) and translates them at prompt-build time; example_dialogue is referenced as "rhythm model" without requiring output in the same language. (Since O3 방3 these presets are voice only — the review's substance comes from the seat fields in config.)

The webapp takes the same approach: `personality-types.ts` has `PERSONALITY_TYPES` (ko, full) and `PERSONALITY_TYPES_EN` (en, structural only). Plugin-v2 inherits this split.

## Mixing languages

If user input is in English but locale is `ko`, plugin responds in Korean (respecting config) but can include the English phrases inline in `<user-data>` tags. Vice versa.

If users want ad-hoc locale override without editing config, `/argus:sail --locale en "..."` flag support is **post-MVP**.
