# Rendering Rules

> Argus 전 스킬 공유 디자인 언어.
> 모든 스킬은 이 규칙을 따른다. 예외 없음.

---

## Core Principle: Markdown First

Argus 출력은 **마크다운**이다. 터미널, Slack, Notion, 이메일 어디서든 읽힌다.
고정폭 박스 드로잉은 사용하지 않는다.

---

## Typography

| Element | Format | Example |
|---------|--------|---------|
| Stage header | `**Argus · [단계명]**` | `**Argus · 초안 완성**` |
| Section title | `**[제목]**` | `**숨겨진 전제**` |
| Stage separator | `---` | (horizontal rule) |
| Emphasis | `**bold**` | `**리스크 1: 시장 타이밍.**` |
| Key terms | `**bold**` inline | `**핵심 용어** 볼드` |

## Forbidden

- `╭╮╰╯┌│└┘═══────` box drawing characters
- Fixed-width formatting assumptions
- `76-char` or any character-count constraints
- Academic citations in output (ok in reference files)
- Generic praise ("좋은 질문입니다", "잘 정리하셨네요")

---

## Diff Blocks = Color

Diff blocks are the primary way to add visual weight and semantic color.

```diff
+ positive / confirmed / good     → green
- negative / risk / uncertain     → red
```

### Usage by semantic meaning:

| Meaning | Format | Example |
|---------|--------|---------|
| Reframed question | `+ ▸ [질문]` | `+ ▸ 진짜 질문: 시장이 존재하는가?` |
| Confirmed/good | `+ ✓ [항목]` | `+ ✓ 시장 규모 검증 완료` |
| Risk/doubt | `- ✗ [항목]` | `- ✗ 경쟁사 반응 미검증` |
| Uncertain | `- ? [항목]` | `- ? 팀 역량 확인 필요` |
| Unspoken risk | `- 🔇 [항목]` | `- 🔇 대표님이 이미 결론 냈을 수 있음` |
| Failure scenario | `- ✗ [시나리오]` | `- ✗ 6개월 뒤: 시장 반응 없어 피봇` |
| Regret test | `- ⏳ [후회]` | `- ⏳ 1년 후: 고객 검증 건너뛴 게 치명적` |

**Max 3 diff lines per section.** More than that dilutes visual impact.

---

## Actor Emoji

| Actor | Emoji | Meaning |
|-------|-------|---------|
| AI | 🤖 | AI가 수행 |
| Human | 🧑 | 사람이 판단 |
| Both | ⚡ | AI 초안 + 사람 검증 |
| Human→AI | 🧑→🤖 | 사람이 방향 설정, AI가 실행 |
| AI→Human | 🤖→🧑 | AI가 초안/분석, 사람이 최종 판단 |
| Human (offline) | 🧑⏳ | 이 세션 밖에서 해야 할 것 |
| Checkpoint | ⚑ | 다음 단계 전 승인 필요 |
| Critical path | ★ | 지연 시 전체 일정에 영향 |

---

## Severity Indicators

| Severity | Format | Use in |
|----------|--------|--------|
| Critical | 🔴 critical | DM 우려 사항 테이블 — "이거 빠지면 통과 안 됨" |
| Important | 🟡 important | DM 우려 사항 테이블 — "있으면 훨씬 좋음" |
| Minor | ⚪ minor | DM 우려 사항 테이블 — "있으면 좋지만 없어도 됨" |

---

## Convergence Indicators

| State | Format | Meaning |
|-------|--------|---------|
| Converged | `✅ 수렴` | 추가 라운드 불필요, 진행 가능 |
| Almost | `🟡 거의 수렴` | 1라운드 더 하면 안정 |
| Not yet | `🔴 미수렴` | 핵심 이슈 잔존 |
| Score | `[N]/100` | convergence score 표시 |

---

## Assumption Evaluation State

| State | Symbol | Meaning |
|-------|--------|---------|
| Confirmed | `+ ✓` (diff) | 사용자가 맞다고 확인 |
| Uncertain | `- ?` (diff) | 모르겠음 — 검증 필요 |
| Doubtful | `- ✗` (diff) | 틀릴 가능성 높음 — 최우선 검증 |

각 가정에 축(axis) 표시: `[가치]`, `[실현]`, `[사업]`, `[역량]`

---

## Tables

Use pipe tables for structured data. No alignment characters beyond `|`.

```markdown
| # | 항목 | 내용 | 비고 |
|---|------|------|------|
| 1 | ... | ... | ... |
```

---

## Visual Hierarchy (우선순위)

1. **"진짜 질문"** → diff block (`+ ▸`) — 가장 중요한 한 줄, 녹색 강조
2. **OK 조건** → blockquote (`> **OK 조건:**`) — 승인 핵심, 시각적 분리
3. **리스크 섹션** → `⚠️` 접두사 — 다른 섹션과 무게 차별
4. **잘된 점** → diff block (`+ ✓`) — 우려와 대비
5. **뼈대 항목** → bold 번호 (`1. **항목**:`) — 변경 시에만 diff
6. **단계 전환** → `---` + `**Argus · [단계명]**`
7. **수렴 상태** → convergence indicator + score

---

## Code Blocks

Code blocks are for **structured data only**:
- YAML contracts
- Sharpened prompts (copy-paste용)
- Implementation prompts

**NOT for:** general output, analysis text, persona cards.

---

## Blockquotes

Use for:
- OK 조건: `> **OK 조건:** [text]`
- Transitional remarks: `> 이건 초안이다. 몇 가지만 더 알면 훨씬 날카로워진다.`
- Persona quotes: `> "[직접 인용]"`
- Insights: `> 💡 [인사이트]`
- Framing confidence: `> 프레이밍 확신도: [N]/100`

---

## Section Patterns

### Step output pattern:
```markdown
---

**Argus · [단계명]**

[content]

---
```

### Insight pattern:
```markdown
**💡** [발견된 핵심 — 1문장, bold]
```

### Self-check pattern (internal, not shown to user):
```markdown
- [ ] [check item]
- [ ] [check item]
```

---

## Language Rules

- **Content:** Always in user's language
- **UI chrome (emoji, symbols, `---`):** Language-independent
- **Tone:** Direct. "이건 초안이다" not "이건 초안일 수 있습니다"
- **Name what you DON'T know.** Don't pretend.
