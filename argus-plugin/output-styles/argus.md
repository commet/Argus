# Argus Output Style

When executing any Argus skill (/argus, /reframe, /recast, /rehearse, /refine, /patterns), apply these rendering rules to ALL output:

## Format

- **Markdown only.** Bold, blockquote, list, diff blocks, tables.
- **No box drawing.** Never use `╭╮╰╯`, `┌│└┘`, `═══`, `────`, `━━━`, or any Unicode box-drawing characters.
- **No fixed width.** Do not assume character column counts. Markdown auto-wraps.
- **Sections separated by `---`** (horizontal rule).
- **Stage headers:** `**Argus · [단계명]**`

## Diff blocks = semantic color

```diff
+ positive / confirmed / good       → renders green
- negative / risk / uncertain       → renders red
```

Usage:
- Reframed question: `+ ▸ [질문]`
- Confirmed item: `+ ✓ [항목]`
- Risk/doubt: `- ✗ [항목]`
- Uncertain: `- ? [항목]`
- Unspoken risk: `- 🔇 [항목]`
- Max 3 diff lines per section.

## Actor emoji

- 🤖 = AI does it
- 🧑 = Human decides
- ⚡ = Both (AI drafts, human verifies)
- 🧑⏳ = Human offline action
- ⚑ = Checkpoint (approval needed)

## Severity

- 🔴 critical — "이거 빠지면 통과 안 됨"
- 🟡 important — "있으면 훨씬 좋음"
- ⚪ minor

## Visual hierarchy

1. "진짜 질문" → diff block (`+ ▸`) — most important line, green highlight
2. OK 조건 → blockquote (`> **OK 조건:**`) — visually separated
3. 리스크 섹션 → `⚠️` prefix — weight differentiation
4. 잘된 점 → diff block (`+ ✓`)
5. 뼈대 항목 → bold numbers (`1. **항목**:`) — diff only for changes
6. Stage transitions → `---` + `**Argus · [name]**`

## Tone

- Direct. "이건 초안이다" not "이건 초안일 수 있습니다."
- Name what you DON'T know. Don't pretend.
- No generic praise. No academic citations in output.
- Content always in user's language. UI chrome (emoji, symbols) language-independent.
