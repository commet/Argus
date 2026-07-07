# Plugin Output Redesign — 실행 로그

> 2026-03-30 실행. `docs/plugin-output-redesign.md` 계획서 기반.

---

## 변경 원칙

| Before | After |
|--------|-------|
| 전체 카드를 하나의 code block | 마크다운 섹션 (`---` 구분) |
| 박스 드로잉 (`╭╮╰╯`, `┌│└`, `═══╪`, `───┼`, `━━━`) | 제거. `---`, `**bold**`, 여백으로 구조 |
| 76-char 고정 폭 | 제거. 마크다운 자동 래핑 |
| 유니코드 테이블 (파이프+구분선) | 표준 마크다운 테이블 |
| 가정 표시: `✓ │`, `? │` 파이프 | ` ```diff ` 블럭 (`+`=확인/녹색, `-`=미확인/빨강) |
| 💡 인사이트: code block 내부 | `> blockquote` |
| Quick action: code block 내부 | `` `인라인 코드` `` |
| 페르소나: `┌└` 카드 블럭 | `**bold**` + 리스트 또는 diff+blockquote |
| 엔진 추천: code block | `> blockquote` |
| 헤더: `╭──╮` 박스 | `**bold**` 텍스트 |

---

## 파일별 변경 내역

### 1. /reframe (`/.claude/skills/reframe/SKILL.md`)

**렌더링 규칙** (구 122-127행)
- "ONE code block" → "마크다운 기본, code block은 인터뷰 질문/구조 데이터만"
- No box drawing / No fixed width / diff blocks = color tool 규칙 추가

**Overview + Q1 템플릿** (구 144-172행)
- `╭──Argus · Reframe──╮` 박스 → `**Argus · Reframe** — ● Interview · ○ Assumptions · ○ Reframe`
- 인터뷰 질문만 code block 유지, 헤더/진행 표시는 마크다운

**Phase 2 가정 템플릿** (구 324-341행)
- `╭──╮` 박스 헤더 → `**Argus · Reframe** — ✓ Interview · ● Assumptions · ○ Reframe`
- 가정 질문은 code block 유지 (선택지 정렬)

**Phase 3 최종 카드** (구 414-481행) — 전면 교체
- 단일 code block → 마크다운 섹션:
  - `**🎯 Reframe**` 볼드 헤더
  - `**물어본 것:**` / `**진짜 질문:**` 볼드 레이블
  - 가정 → ` ```diff ` 블럭
  - 먼저 확인 → 넘버 리스트 (`1. 2. 3.`)
  - 💡 → `> blockquote`
  - Quick action → `` `인라인 코드` ``

**수정 메뉴** — code block → blockquote 리스트

---

### 2. /recast (`/.claude/skills/recast/SKILL.md`)

**렌더링 규칙** (구 24행)
- "ONE code block" → 마크다운 섹션 + 동일 3개 규칙 추가

**헤더** (구 53-57행)
- `╭──📋 Argus · Recast──╮` → `**📋 Argus · Recast**`

**Reflection block** — code block → `> blockquote`

**Topic linking** — code block → `> blockquote`

**Zero-confirmed 경고** — code block → `> blockquote`

**엔진 추천** — code block → `> 💡 **엔진 추천:**` blockquote

**Decide context 카드** (구 275-320행) — 전면 교체
- 실행 테이블: `════╪═══` 유니코드 → 표준 마크다운 테이블
- 가정: `✓ │` 파이프 → ` ```diff ` 블럭
- 페르소나: `┌└` 카드 → 넘버드 볼드 리스트

**Build context 카드** (구 327-374행) — 전면 교체
- Product thesis → ` ```diff ` 블럭 (녹색 강조)
- MVP 테이블 → 표준 마크다운 테이블
- Scope cuts → `**✂ Scope Cuts:**` 볼드+인라인
- 가정 → diff 블럭
- 페르소나 → 불릿 리스트 (`🎯`, `🤨`)

**수정 메뉴** — code block → blockquote

---

### 3. /rehearse (`/.claude/skills/rehearse/SKILL.md`)

**렌더링 규칙** (구 23행)
- "ONE code block" → 마크다운 섹션 + 3개 규칙 추가

**헤더** (구 53-59행)
- `╭──👥 Argus · Rehearse──╮` → `**👥 Argus · Rehearse**`

**Topic linking / Reflection block** — code block → `> blockquote`

**엔진 추천 3개** (Condition A/B/C) — 모두 code block → `> 💡 **엔진 추천:**` blockquote

**Decide context 카드** (구 229-265행) — 전면 교체
- 바꿔야 할 것 → 넘버 리스트
- 페르소나별: `┌│└` 카드 → `**bold**` 헤더 + diff 블럭(리스크) + `> blockquote`(발언)
- Devil's Advocate → diff 블럭
- 💡 → blockquote

**Build context 카드** (구 267-305행) — 동일 패턴
- 핵심 발언 섹션 → blockquote

**수정 메뉴** — code block → blockquote

---

### 4. /refine (`/.claude/skills/refine/SKILL.md`)

**렌더링 규칙** (구 20행)
- "ONE code block" → 마크다운 섹션 + 3개 규칙 추가

**헤더** (구 43-49행)
- `╭──🔧 Argus · Refine──╮` → `**🔧 Argus · Refine**`

**Topic linking / Reflection block** — code block → blockquote

**엔진 추천 2개** (Condition A/B) — code block → blockquote

**출력 카드** (구 207-242행) — 전면 교체
- 변경 테이블: `════╪═══` → 표준 마크다운 테이블 (`| # | 변경 | 이유 |`)
- 재검증: `┌└` 카드 → diff 블럭 + blockquote
- 수렴: 유니코드 바 → diff 블럭 (`-` critical, `+` conditions)

**Deferred validation** — code block → 볼드 텍스트

---

### 5. /argus (`/.claude/skills/argus/SKILL.md`)

**파이프라인 헤더** (구 87-92행)
- `╭──Argus · 4R Pipeline──╮` → `**Argus · 4R Pipeline** — reframe → recast → rehearse → refine`

**DQ 스코어카드** (구 347-360행)
- `━━━` 구분선 + 고정폭 텍스트 → 마크다운 테이블
  ```
  | Element | Score |
  |---------|-------|
  | Framing | ████░ 4/5 |
  | **Overall** | **77/100** |
  ```

**기타** — breadcrumb diff 블럭, anti-sycophancy diff, yaml harness 등은 이미 적절한 포맷이라 유지

---

## 미적용 (우선순위 낮음)

리디자인 문서 §8에서 "우선순위 낮음"으로 분류한 유틸리티 스킬:

- `/.claude/skills/configure/SKILL.md` — 박스 헤더 3개 잔존
- `/.claude/skills/doctor/SKILL.md` — 박스 헤더 1개 잔존
- `/.claude/skills/patterns/SKILL.md` — 박스 헤더 2개 잔존
- `/.claude/skills/setup/SKILL.md` — 박스 헤더 2개 잔존

이들은 현재도 심플한 출력이라 필요 시 추후 처리.

---

## 검증

모든 핵심 5개 스킬에서 박스 드로잉 문자(`╭╮╰╯┌┐└┘╔╗╚╝│┼━═`) 검색 결과: **규칙 설명 문구에만 존재** (실제 출력 템플릿에는 0개).
