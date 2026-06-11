# Locale Conventions

Every skill honors `config.locale` from `.argus/config.yaml`.

**Resolution order (L3.3):**
1. `config.locale` if present — authoritative.
2. Config missing/field absent → infer from the user's CURRENT conversation
   language if it is unambiguous (their last 2+ messages clearly one language).
3. Still ambiguous (mixed/none) → ask ONCE: "Korean or English? / 한국어로
   할까요, 영어로 할까요?" — then write the answer back to `.argus/config.yaml`
   (`locale: ko|en`) so the question never repeats. Never silently default on
   an ambiguous signal: a wrong-language session reads as broken.

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

MBTI `example_dialogue` entries in `data/boss-types.yaml` are Korean-only. This is **intentional**: the archetype's rhythm is modeled on Korean workplace culture. For locale=en, the boss prompt keeps the structural personality fields (communicationStyle, feedbackStyle, triggers, speechPatterns, bossVibe) and translates them at prompt-build time; example_dialogue is referenced as "rhythm model" without requiring output in the same language.

The webapp takes the same approach: `personality-types.ts` has `PERSONALITY_TYPES` (ko, full) and `PERSONALITY_TYPES_EN` (en, structural only). Plugin-v2 inherits this split.

## Mixing languages

If user input is in English but locale is `ko`, plugin responds in Korean (respecting config) but can include the English phrases inline in `<user-data>` tags. Vice versa.

If users want ad-hoc locale override without editing config, `/argus:sail --locale en "..."` flag support is **post-MVP**.
