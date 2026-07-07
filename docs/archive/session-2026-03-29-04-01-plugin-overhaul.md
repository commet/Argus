# Plugin Overhaul — 2026-03-29 ~ 04-01 작업 로그

> 이 문서는 다른 세션에서 이어서 작업할 때 맥락을 빠르게 잡기 위한 것.
> 무엇을 했고, 왜 했고, 무엇이 남았는지.

---

## 1. 한 문단 요약

플러그인 5개 스킬(argus, reframe, recast, rehearse, refine)의 출력 포맷을 코드블럭 기반에서 마크다운 기반으로 전환하고, /argus를 webapp의 progressive engine(`progressive-engine.ts` + `progressive-prompts.ts`)과 동기화했다. 핵심 변화: 고정 2질문 인터뷰 → 2-3라운드 progressive deepening, Mix(문서 합성) 단계 신설, DM 피드백에 severity + fix_suggestion 구조 추가, AskUserQuestion 도구 전면 활용, 시각 위계 규칙 확립.

---

## 2. 작업 타임라인

### Phase 1: 출력 포맷 리디자인 (03-29)

**문제**: LLM은 레이아웃 엔진이 아닌데, 유니코드 박스 드로잉(`╭╮╰╯`, `═══╪`) + 코드블럭 안에서 포맷팅을 시도하고 있었음. 한글 더블바이트 깨짐, 매번 다른 출력, 인지 부하.

**계획서**: `docs/plugin-output-redesign.md` — 생태계 조사 + Claude Code 렌더링 역량 분석 기반.

**변경**:
- 5개 스킬 SKILL.md에서 박스 드로잉 전면 제거
- 렌더링 규칙 교체: diff 블럭(색상), bold(레이블), blockquote(인사이트), 마크다운 테이블
- 76-char 고정폭 제거 → 자동 래핑

**관련 커밋**: `plugin-output-redesign-changelog.md`에 파일별 상세 기록.

### Phase 2: Progressive Engine 동기화 (03-31)

**배경**: webapp에서 `progressive-engine.ts` + `progressive-prompts.ts` + `ProgressiveFlow.tsx`가 구현됨. 이 엔진의 알고리즘을 plugin에 반영해야 함.

**webapp 엔진 구조** (이해 필수):
```
runInitialAnalysis → snapshot v0 + question 1
runDeepening (반복) → snapshot vN + question N (or readyForMix)
runMix → MixResult (title, summary, sections, assumptions, next_steps)
runDMFeedback → DMFeedbackResult (concerns with severity + fix)
runFinalDeliverable → 최종 문서 (선택된 fix 적용)
```

**핵심 프롬프트 파일**: `src/lib/progressive-prompts.ts` — 5개 함수의 system/user prompt가 있음. Plugin의 SKILL.md 인스트럭션은 이 프롬프트의 정신을 따라야 함.

**변경 — /argus 전면 재작성**:

| Before | After |
|--------|-------|
| Step 2: 고정 2질문 | Step 2: Progressive Deepening 2-3라운드 반복 |
| Interview → DM 직행 | Interview → **Mix (문서 합성)** → DM |
| DM 피드백: 약점 + 수정 | DM 피드백: severity(🔴🟡⚪) + fix_suggestion + OK 조건 |
| 자동 전체 수정 | **사용자가 fix 선택** (AskUserQuestion) |
| 스켈레톤: 코드블럭 | 뼈대: bold 넘버링, 변경 시 diff |

**변경 — 나머지 4개 스킬**:
- `/rehearse`: 우려에 severity 테이블 추가 (🔴/🟡/⚪ + 수정 방향)
- `/refine`: 토글 fix 개념 (critical 자동, 나머지 AskUserQuestion으로 선택)
- `/recast`: 스켈레톤 품질 규칙 강화 ("시장 분석" 금지 → "시장 현황: 경쟁사 3곳의 접근법과 차이점")
- `/reframe`: 변경 없음 (이미 피봇에서 재작성됨)

### Phase 3: 디자인 품질 강화 (04-01)

**문제**: 실제로 `/argus`를 돌려보니 시각 위계가 약함. 진짜 질문이 묻히고, 잘된 점에 색상 없고, OK 조건이 평범한 텍스트.

**수정 6가지**:
1. "진짜 질문" → `diff` 블럭 `+ ▸` (녹색 강조)
2. "잘된 점" → `diff` 블럭 `+ ✓` (녹색)
3. "OK 조건" → `> blockquote` (시각 분리)
4. 리스크 섹션 → `⚠️` 접두사 + bold 리스크명
5. 뼈대 → 코드블럭 제거, `1. **항목**: 설명` 마크다운 넘버링
6. Rendering rules에 "Visual hierarchy rules" 6개 원칙 추가

### Phase 3.5: Statusline (04-01)

`argus-plugin/statusline/index.js`의 Line 3에 추가:
- 프로젝트명 (bold white)
- 현재 단계 (색상 코딩)
- 판단자 (yellow)
- 전제 패턴 (✓/?/✗ + 라벨)

---

## 3. 현재 파일 상태

### Plugin 스킬 (`.claude/skills/`)

| 스킬 | 상태 | 마지막 변경 |
|------|------|-----------|
| `/argus` | ✅ Progressive engine 동기화 + 디자인 완료 | 04-01 |
| `/reframe` | ✅ 피봇에서 재작성 + AskUserQuestion | 03-30 |
| `/recast` | ✅ 품질 규칙 추가 | 03-31 |
| `/rehearse` | ✅ severity 테이블 추가 | 03-31 |
| `/refine` | ✅ 토글 fix 추가 | 03-31 |
| `/configure` | ⚠️ 박스 드로잉 잔존 (우선순위 낮음) | 미변경 |
| `/doctor` | ⚠️ 박스 드로잉 잔존 (우선순위 낮음) | 미변경 |
| `/patterns` | ⚠️ 박스 드로잉 잔존 (우선순위 낮음) | 미변경 |
| `/setup` | ⚠️ 박스 드로잉 잔존 (우선순위 낮음) | 미변경 |
| `/help` | ✅ 03-30 업데이트 | 03-30 |

### Webapp (참고)

| 파일 | 역할 |
|------|------|
| `src/lib/progressive-engine.ts` | LLM 호출 오케스트레이션 |
| `src/lib/progressive-prompts.ts` | **5개 핵심 프롬프트** — Plugin의 진짜 소스 |
| `src/stores/useProgressiveStore.ts` | Zustand 상태 관리 |
| `src/components/workspace/progressive/ProgressiveFlow.tsx` | UI 컴포넌트 |
| `src/stores/types.ts` | ProgressiveSession, DMConcern 등 타입 정의 |

---

## 4. 설계 원칙 (이어서 작업할 때 반드시 참고)

### 출력 디자인 도구 (마크다운만 사용)

| 도구 | 용도 | 제한 |
|------|------|------|
| `` ```diff `` | 색상 — `+` 녹색, `-` 빨강 | 섹션당 최대 3개 |
| `**bold**` | 섹션 레이블, 핵심 용어 | |
| `> blockquote` | 인사이트(💡), 인용, OK 조건 | |
| `---` | 섹션/단계 구분 | |
| 마크다운 테이블 | 우려 사항(severity), 변경 사항 | |
| `` `인라인 코드` `` | Quick action, 명령어 | |

### 시각 위계 규칙

1. **"진짜 질문"** → 항상 diff `+ ▸` (녹색 강조, 가장 중요)
2. **잘된 점** → diff `+ ✓` (녹색)
3. **우려 사항** → severity 테이블 (🔴🟡⚪)
4. **OK 조건** → `> blockquote` (시각 분리)
5. **리스크** → `⚠️` 접두사
6. **뼈대 항목** → bold 넘버링, 변경 시 diff
7. **단계 전환** → `---` + `**Argus · [단계명]**`

### AskUserQuestion 사용 원칙

- 모든 질문은 AskUserQuestion 도구로 (텍스트로 타이핑 금지)
- options에 항상 label + description
- 2-4개 옵션 (Other는 자동 제공됨)
- Mix 트리거, fix 선택, DM 시뮬레이션 여부 모두 AskUserQuestion

### Multi-turn 원칙

- Progressive Deepening은 **여러 턴에 걸쳐 진행** (한 번에 다 출력하지 않음)
- 각 라운드: 출력 + AskUserQuestion → 사용자 답변 → 업데이트 + 다음 AskUserQuestion
- 라운드 전환 시 이전 답변을 명시적으로 레퍼런스

---

## 5. 남은 작업

### 즉시 해야 할 것
- [ ] 실제 `/argus` 테스트 2-3회 → 출력 품질 확인 + 튜닝
- [ ] Build context 분기 테스트 (제품/앱 만드는 시나리오)
- [ ] 개별 스킬 (`/reframe`, `/recast`, `/rehearse`, `/refine`) 각각 1회 테스트

### 하면 좋은 것
- [ ] 유틸리티 스킬(configure, doctor, patterns, setup) 박스 드로잉 제거
- [ ] `/reframe`의 시각 위계를 `/argus`와 동일하게 맞추기 (진짜 질문 diff 등)
- [ ] `/rehearse`의 Build context 출력도 severity 테이블로 완전 통일
- [ ] Statusline에 round 진행률 표시 (Round 2/3)
- [ ] Plugin 설치 시 statusline 자동 설정 (setup 스킬에서)

### 장기
- [ ] 개별 스킬과 /argus 사이의 중복 정리 — /argus가 개별 스킬을 내부적으로 호출하는 구조?
- [ ] Plugin의 Context Contract와 webapp의 ProgressiveSession 데이터 모델 통일
- [ ] DQ Score 계산 로직을 webapp의 `decision-quality.ts`와 맞추기

---

## 6. 핵심 참조 문서

| 문서 | 내용 |
|------|------|
| `docs/plugin-output-redesign.md` | 출력 포맷 리디자인 계획서 (생태계 조사, 렌더링 역량 분석) |
| `docs/plugin-output-redesign-changelog.md` | Phase 1 변경 상세 로그 |
| `docs/milestone-2026-03-30-compact-pivot.md` | 종화 피드백 기반 피봇 전체 기록 |
| `src/lib/progressive-prompts.ts` | **Plugin 프롬프트의 진짜 소스** |
| `src/lib/progressive-engine.ts` | Webapp 엔진 구조 |
| `.claude/skills/argus/SKILL.md` | Plugin 핵심 — 가장 최근 변경 |

---

## 7. 빠른 시작 (이어서 작업할 때)

```bash
# 현재 상태 확인
git log --oneline -10

# Plugin 테스트
/argus 개발자인데 대표님이 2주 안에 기획안을 써오라고 했어

# 개별 스킬 테스트
/reframe 동남아 시장 진출을 검토하고 있어
/recast  (reframe 결과가 있는 상태에서)
/rehearse (recast 결과가 있는 상태에서)

# 출력 디자인 확인 포인트
# - 진짜 질문이 diff 녹색인가?
# - 뼈대가 bold 넘버링인가? (코드블럭 아님)
# - DM 피드백에 severity 테이블 있는가?
# - OK 조건이 blockquote인가?
# - AskUserQuestion이 실제로 호출되는가? (텍스트 아님)
```
