# Argus 종합 세션 정리 — 2026-03-25 ~ 2026-03-28

> 4일, 51개 커밋, 226개 파일, +32,293줄 / -1,559줄
> 전략 수립 → 학술 기반 설계 → 웹앱 구현 → 플러그인 패키징 → 테스트 인프라 → 자기 비평 → 개선 설계

---

## 목차

1. [4일 요약](#4일-요약)
2. [전략 — 무엇이고 왜 하는가](#전략--무엇이고-왜-하는가)
3. [학술 기반](#학술-기반)
4. [구현 — 웹앱](#구현--웹앱)
5. [구현 — 플러그인](#구현--플러그인)
6. [테스트 인프라](#테스트-인프라)
7. [Judgment Vitality Engine](#judgment-vitality-engine)
8. [Skill Quality Eval](#skill-quality-eval)
9. [Pipeline Overhaul](#pipeline-overhaul)
10. [자기 비평 + 개선 로드맵](#자기-비평--개선-로드맵)
11. [보안](#보안)
12. [현재 아키텍처](#현재-아키텍처)
13. [열린 질문과 다음 작업](#열린-질문과-다음-작업)

---

## 4일 요약

| 날짜 | 핵심 | 커밋 | 파일 |
|------|------|------|------|
| 03-25 | 전략 수립 + 40편 논문 리서치 + 웹앱 구현 (DQ·학습 루프·보상 체계·랜딩) | 1 | 22 (+2,927) |
| 03-26 | 플러그인 패키징 + 웹앱 개선 (Supabase·보상 애니메이션·cross-stage coaching) | ~20 | ~80 |
| 03-28 | 테스트 대공사 + Vitality Engine + Eval v2 + Pipeline Overhaul + 자기 비평 | 13 | 60 (+11,698) |
| 합계 | — | **51** | **226 (+32,293 / -1,559)** |

### 4일간 달라진 것

| 항목 | 03-25 시작 | 03-28 종료 |
|------|-----------|-----------|
| 제품 형태 | 웹앱만 | 웹앱 + CLI 플러그인 |
| 테스트 | 480개 (66 failing) | **993개 (0 failing)** |
| 보안 수정 | — | 37건 (8 라운드) + safeCompare bypass |
| 학술 기반 | 0편 | **40편 논문** |
| DQ 측정 | 없음 | DQ 6요소 + Outcome Tracking + Vitality Engine |
| Eval 기준 | 0개 | **33개** (structural 8 + content 20 + chaining 5) |
| 자기 비평 | — | 치명적 결함 5개 식별 + 3-Phase 개선 설계 |

---

## 전략 — 무엇이고 왜 하는가

### 정체성

- **내부:** "판단 설계 메타 레이어" — AI 에이전트 실행 전 시작점을 설계하는 도구
- **외부:** "생각을 뾰족하게" — 사용자 언어 기반 카피
- **Hero:** "AI에게 시키기 전에, 생각을 뾰족하게."

### 핵심 테제

> AI가 더 자율적으로 일할수록, 시작점의 판단이 더 중요해진다. Argus는 그 시작점을 설계하는 메타 레이어다.

- 인간 개입 "최소화"가 아니라 인간 판단의 "밀도"를 높이는 도구
- 4단계(Reframe → Recast → Rehearse → Refine)는 줄이지 않되, 데이터 축적으로 속도와 마찰을 줄이는 방향

### 시장 상황

- "구조화된 다관점 AI 의사결정 제품" = **0개**
- "AI 악마의 대변인 제품" = **0개**
- Manyfast = "문서 생성기" (What to build), Argus = "판단 설계 도구" (Should we? Why?)
- McKinsey/BCG는 내부 도구만. GIC, Audax PE가 자체 개발해야 했을 정도로 공백

### 배포 전략

- **웹앱이 본진** — 프롬프트 보호 + 데이터 수집 + 수익화
- **플러그인은 진입점** — 가치 경험 → 웹앱으로 유도
- MCP는 맛보기용으로만, sync-back 모델은 사용자 거부감으로 기각

### Anthropic 관점

- Anthropic이 못 풀고 있는 sycophancy 문제(58% 상황)를 제품 레이어에서 우회 → 보완적 가치
- 가장 현실적 경로: 리서치 가치 — "Argus가 효과가 있다"는 데이터
- Anthropic 하네스 디자인 아티클 적용: Generator-Evaluator 분리, 주관적 품질의 정량화, Sprint Contract

### 3가지 Deliverable

1. **Sharpened Prompt** — 바로 AI에 붙여넣을 수 있는 더 나은 질문
2. **Thinking Summary** — 팀에 공유할 슬랙 형식 요약
3. **Agent Harness** — CLAUDE.md 형태의 에이전트 실행 지시서

---

## 학술 기반

40편 논문, 3개 영역 병렬 검색.

### 핵심 발견

| 출처 | 발견 | Argus 연결 |
|------|------|-------------|
| Dell'Acqua/Harvard-BCG (758명) | 구조화 AI가 자유대화 대비 12% 우수 | 4R 파이프라인 존재 이유 |
| Du/MIT | 멀티에이전트 토론 → 추론 정확도 8%p ↑ | 페르소나 다관점 토론 |
| Sharma/Anthropic | 58% 상황에서 아첨, 78.5%는 구조적 문제 | Anti-sycophancy 설계 |
| Klein/HBR | 프리모템 → 위험 식별 30% ↑ | /rehearse 사전 검증 |
| Spetzler | DQ 6요소 — 결과와 독립적 프로세스 품질 | DQ 스코어링 |
| Mandel 2024 | ACH는 판단 품질 향상에 효과 미미 | "프로세스 준수 ≠ 사고 품질" 경고 |
| CHI 2025 | AI 신뢰도 ↑ → 비판적 사고 ↓ | Vitality Engine 경직 감지 |

### Argus 고유 연구 질문

> "개별 기법(CoT, 멀티에이전트, 프리모템, 악마의 대변인)을 하나의 워크플로우로 통합했을 때 시너지가 있는가?"

---

## 구현 — 웹앱

### 03-25: 학술 기반 시스템 구축

| 영역 | 내용 |
|------|------|
| Eval 확장 | Recast(4) + Rehearsal(4) + Refinement(4) = 12개 신규 (총 16개) |
| Outcome Tracking | `outcome-tracker.ts` — 실행 결과 기록, 페르소나 예측 정확도, 가설 검증 |
| 학습 루프 | retrospective 답변 + outcome 인사이트 → AI 프롬프트 자동 주입 |
| DQ 측정 | DQ 6요소 자동 계산 + 트렌드 + DQ↔Outcome 상관 |
| 보상 체계 | 4단계별 차별화된 보상 카드 + 학술 인용 |
| 랜딩 | "생각을 뾰족하게" + 논문 인용 ProcessFlow + UseCaseFlow |

### 03-26: 웹앱 개선

| 영역 | 내용 |
|------|------|
| DQ 버그 | 중복 계산 수정 + localStorage 멱등성 |
| Supabase | outcome_records, retrospective_answers, decision_quality_scores 테이블 + RLS |
| 보상 카드 | useCountUp 훅, animate-bar-grow, animate-score-pop |
| Cross-stage | 악보→편곡, 편곡→리허설, DQ 추이→합주 concertmaster 연동 |
| Persona 정확도 | outcome 기록 기반 페르소나 예측 정확도 표시 |
| Outcome 알림 | 2주 이상 미기록 프로젝트 넛지 + 데일리 stale 리포트 |

---

## 구현 — 플러그인

### 구조 (16개 파일)

```
argus-plugin/
├── .claude-plugin/plugin.json
├── install.sh (원라인 설치 + ASCII 로고)
├── agents/
│   └── devils-advocate.md (context: fork)
└── skills/
    ├── help/        (/argus-help)
    ├── reframe/     + references/reframing-strategies.md
    ├── recast/      + references/execution-design.md
    ├── rehearse/    + references/persona-design.md, risk-classification.md
    ├── refine/      + references/convergence.md
    └── argus/    + references/decision-quality.md
```

### CLI 디자인 시스템

- 76자 폭 통일 (이전 46-55 불일치)
- 헤더 박스(╭╮╰╯) + 섹션(■) + 구분선(━━━/───) + 옵션(1·) + 스텝 박스(┌│└)
- 모든 디자인 출력은 fenced code block 안에 (모노스페이스 보장)
- 영어 기본 + 콘텐츠는 사용자 언어

### 시그니처 요소

- **"What you didn't see"** — 매 실행 끝에 불편한 사각지대 한 문장
- **학습 저널** (`.argus/journal.md`) — 매 실행 후 자동 기록, 재사용 시 패턴 참고

---

## 테스트 인프라

**480개(66 failing) → 993개(0 failing), 20→40 파일.**

### 9개 Loop 진행

| Loop | 내용 |
|------|------|
| 1 | 핵심 lib 시뮬레이션 — DQ, persona, context-builder 등 7개 |
| 2 | 스킬 오디트 — autoplay/build 삭제, execution-design.md 완성 |
| 3 | 미커버 lib 7개 — LLM, sanitize, retrospective, slack-blocks 등 |
| 4 | LLM 네트워크 + Store mutation + **DQ 캐시 무효화 버그 수정** |
| 5 | 통합 테스트 — DOM sanitize(jsdom), API validation(49개) + **safeCompare bypass 보안 수정** |
| 6 | 미테스트 lib 9개 — api-security, outcome-tracker, document-generators 등 |
| 7 | Skill Quality Eval v1 — 69개 기준 |
| 8 | Eval 오탐 6건 수정 + concertmaster crash 수정 |
| 9 | Eval v2 리팩토링 — 69개 → 33개 |

### Factory 추출

`src/lib/__tests__/helpers/factories.ts` — 13개 factory: makeReframe, makeRecast, makeStep, makePersona, makeFeedbackRecord, makeLoop, makeJudgment, makeSignal, makeAssumption, makeKeyAssumption, makeProject, makeAnswer, makeRating

---

## Judgment Vitality Engine

> "서로를 지탱함을 통해서 얻은 안정감과 체계화 때문에 이들은 경직되어 간다."
> — 2014 서울대 "컴퓨터와 마음" 기말 답안 (김재인 교수 수업, Bateson *Mind and Nature*)

**핵심 질문: "이 판단 과정은 살아있는가, 죽어있는가?"**

### 아키텍처 — 4 Phase

1. **Instrumentation** — buildStageFingerprint, translateApprovalsToPlan, buildProvenanceChain
2. **Measurement** — computeStageGamma (각 단계 부가가치 0-1), computeProjectGamma, measureFeedbackNovelty
3. **Detection** — 7종 경직 신호 (User↔AI, User↔Persona, User↔System, System↔System)
4. **Response** — 4-Tier 개입 (힌트 → 플래그 → 구조적 제안 → 메타코칭)

### 핵심 공식

**vitality = γ × (1 - rigidity_score)**

| 범위 | 분류 | 의미 |
|------|------|------|
| >0.7 | alive | 진짜 판단 진행중 |
| 0.4-0.7 | coasting | 루틴화 시작 |
| 0.2-0.4 | performing | 형식적 수행 |
| <0.2 | dead | 순수 compliance |

### 7종 경직 신호

| 신호 | 관계 | severity |
|------|------|----------|
| convergence_too_fast | User↔AI | 0.3 |
| frame_unchanged | User↔AI | 0.6 |
| feedback_predictable | User↔Persona | 0.4 |
| same_persona_set | User↔Persona | 0.3 |
| low_gamma_high_dq | User↔System | 0.7 |
| translated_approval_ignored | User↔System | 0.5 |
| actor_pattern_rigid | User↔System | 0.3 |

### Actor 모델 전환

`ai | human | both` → `human | ai | human→ai | ai→human`

"경계가 아니라 관계를 설계하라" — 누가 하느냐가 아니라 어떤 순서로 협업하느냐.

### 파일 구조

| 파일 | 역할 |
|------|------|
| `src/lib/judgment-vitality.ts` | 엔진 전체 (14개 함수, 841줄) |
| `src/lib/__tests__/judgment-vitality.test.ts` | 단위 40개 |
| `src/lib/__tests__/judgment-vitality-simulation.test.ts` | 시뮬레이션 7개 |
| `docs/judgment-vitality-engine.md` | 설계 문서 |

---

## Skill Quality Eval

### v1 → v2

| | v1 | v2 |
|---|---|---|
| Structural | 37개 | **8개** |
| Content | 23개 | **20개** (PASS/FAIL exemplar + decision_line) |
| Chaining | 9개 | **5개** |
| 총 | 69개 | **33개** |

### 설계 원칙

**1 eval = 1 prompt** (single-aspect judging)

각 eval에 4개 필드: question, decision_line, pass_example, fail_example

### Live Eval 결과

| 단계 | Structural | Content |
|------|-----------|---------|
| /reframe | 100% | 6/6 PASS |
| /recast | 100% | 5/5 PASS |
| /rehearse | 100% | 5/6 |
| /refine | 100% | 5/5 PASS |
| Pipeline chaining | 100% (12/12) | — |

### 기술적 보완 가능성 (embedding)

- 원본↔재정의 유사도 → frame_shift 자동 측정 (LLM 완전 대체)
- generic assumption bank → 뻔한 가정 사전 비교 (LLM 완전 대체)
- cross-stage embedding → 블라인드 스팟 추적

---

## Pipeline Overhaul

SKILL.md 5개 전면 개편. 3개 파이프라인 실행으로 검증.

### 에이전트급 UX

- **Quick actions** (0/1/2/3) + numbered edit targets (a/b/c/d) — 1번 입력으로 의도 전달
- **양방향 탐색** (← 0) — 이전 단계로 돌아가기 + 6가지 engine-driven backward 규칙
- **Reflection blocks** — 처리 중 "thinking appetizer" 표시
- **Severity-based /refine nudge** after /rehearse

### 카드 재설계

76자 폭 통일, 1-line headers + ━━━, pipe tables, card blocks (┌│└), left-pipe only for assumptions (한글 깨짐 방지)

### 저널 풍부화

- 가정/리스크/침묵의 **실제 내용** 기록
- Critique resolution tracking (rehearse → refine 연결)
- Pipeline progress indicator: `reframe ✓ → recast ✓ → rehearse · refine ·`
- Per-skill readiness score (██░░░ bar)

### Context 분기

```
/reframe  → context: build | decide  ← 인터뷰 질문, 가정 축, 전략이 분기
/recast   → context 상속              ← governing_idea vs product thesis
/rehearse → context 상속              ← 페르소나 선택에 반영
/refine   → context 상속              ← 수렴 기준 동일
/argus → context 자동 감지         ← 딜리버블이 분기
```

---

## 자기 비평 + 개선 로드맵

### 치명적 결함 5개

| # | 결함 | 비유 |
|---|------|------|
| 1 | **결과 피드백 부재** — DQ 72점이 좋은 결정이었는지 영원히 모름 | 테스트 없는 CI/CD |
| 2 | **Decision Theater** — 인지적 위안. 실제 검증 0건으로도 "충분히 검증" 착각 | 잘 구조화된 추측에 숫자를 붙인 것 |
| 3 | **LLM 자기 대화의 천장** — 같은 LLM의 역할극. "그럴듯한 비판"은 만들지만 "예상 못 한 비판"에 한계 | skin in the game 없음 |
| 4 | **삼중 편향** — 사용자 자기 평가 → 전략 선택 → LLM 자기 채점. 외부 신호 제로 | Dunning-Kruger 연쇄 |
| 5 | **Adaptive rules 죽은 코드** — 3회+ 사용 필요, 대부분 1-3번으로 판단 | 최강 기능이 발동 안 함 |

### 근본 문제

> LLM이 만들고, LLM이 평가하고, 사용자가 자기 보고하는 closed system에서 외부 신호가 없다.

### 한 문장 판단

> "혼자 일하는 사람에게 '똑똑한 동료 한 명이 30분 같이 생각해주는 것'의 80%를 제공한다. 목표는 80%를 95%로 올리는 것이 아니라, 80%의 한계를 정직하게 인정하면서 나머지 20%를 사용자가 직접 채우도록 유도하는 것이다."

### 개선 설계 — Crux 관통

**핵심:** Crux(이것만 틀리면 전부 무너지는 가정 1개)가 /reframe에서 식별되어 이후 모든 단계의 초점이 됨.

```
/reframe → Absence Analysis + Crux + Epistemic Status + MVT 제안
    ↓ Contract: crux, assumptions, evidence_basis
/recast → Evidence Gathering (WebSearch) + Outcome Hook
    ↓ Contract: evidence, crux (상속), spec, personas
/rehearse → Evidence-grounded personas + Crux 집중 공격
    ↓ Contract: risks, critiques, crux_attack_result
/refine + /argus → Validation Checklist + Conviction Delta + Epistemic Status
```

### 해자 가능성

| 될 수 있는 것 | 되기 어려운 것 |
|-------------|-------------|
| Crux 관통 설계 (데이터 흐름 복제 어려움) | 4R 파이프라인 구조 (프롬프트 복제 가능) |
| Evidence grounding (실시간 데이터 주입) | 페르소나 역할극 (아무 LLM이나) |
| Outcome-linked calibration (시간 축적 장벽) | DQ 점수 (self-assessed) |
| Epistemic honesty ("70%는 LLM 추론" 선언) | 저널 포맷 (복제 비용 제로) |
| Metacognitive tools (사고 자체를 분석 대상) | |

---

## 보안

### 주요 수정

| 건 | 심각도 | 내용 |
|----|--------|------|
| safeCompare bypass | CRITICAL | `b = a` 재할당으로 길이 비교 무력화 → CRON_SECRET 인증 우회 가능 |
| DQ 캐시 무효화 | HIGH | projectId만으로 캐시, 무효화 없음 → 옛 점수 반환 |
| concertmaster crash | MEDIUM | signals undefined 시 crash → optional chaining |
| 종합 침투 테스트 | — | 8 라운드, 37건 수정 (Edge Runtime nonce + Slack channel ID validation 포함) |

---

## 현재 아키텍처

### 스택

- **프론트:** Next.js + React + Zustand + Tailwind
- **백엔드:** Supabase (PostgreSQL + RLS + Edge Functions)
- **저장:** localStorage first, Supabase async sync
- **플러그인:** Claude Code SKILL.md + agents

### 데이터 흐름

```
사용자 입력
  → Zustand Store (localStorage 즉시 저장)
  → LLM 호출 (callLLM/callLLMStream)
  → 결과 파싱 + eval 기록
  → Signal Recorder (행동 신호 수집)
  → Concertmaster (크로스 스테이지 코칭)
  → Vitality Engine (경직 감지)
  → DQ 계산 + Outcome Tracking
  → Supabase 비동기 sync
```

### 스킬 구조

```
.claude/skills/
├── argus/         풀 파이프라인 오케스트레이터
├── reframe/          Phase 1 + references/reframing-strategies.md
├── recast/           Phase 2 + references/execution-design.md
├── rehearse/         Phase 3 + references/persona-design.md, risk-classification.md
├── refine/           Phase 4
├── help/ configure/ doctor/ setup/ patterns/
├── output-skill/ redesign-skill/ soft-skill/ taste-skill/
└── (기타 유틸리티 스킬)

argus-plugin/skills/  ← CLI와 동일 구조
argus-plugin/agents/
└── devils-advocate.md
```

---

## 열린 질문과 다음 작업

### Phase 1 — SKILL.md만 수정 (코드 0줄, 즉시)

1. Absence Analysis → /reframe에 빈 영역 식별 + 가정 생성 연결
2. Crux Identification → /reframe에 crux 질문 + Contract `crux:` 필드
3. Epistemic Status → /reframe 카드에 근거 수준 2줄
4. Crux 집중 공격 → /rehearse에 Contract crux 최우선 공격
5. Validation Checklist → /refine, /argus에 crux 기반 행동 목록
6. Epistemic Status (누적) → /argus 최종 deliverable

### Phase 2 — 구조 변경

7. MVT 제안 — crux 성격별 검증 방법 매핑
8. Conviction Delta — /argus 시작/끝 확신도 기록
9. Outcome Hook — 저널에 outcome_check 필드 + Before starting rule

### Phase 3 — WebSearch + Embedding

10. Evidence Gathering — /recast에서 WebSearch로 현실 주입
11. Evidence-grounded personas — /rehearse에 evidence 상속 + failure case
12. decision_line 다듬기
13. embedding layer — frame_shift, generic bank, cross-stage
14. eval↔signal-recorder 연결

### 미완성 테스트

- /reframe 전체 플로우 end-to-end (Q1까지만 테스트)
- /recast, /rehearse, /refine, /argus 실사용 테스트 0회
- Devil's Advocate 에이전트 동작 미확인
- 학습 저널 생성/읽기 미확인
- /argus context window 소진 여부 미확인
- 한글 모노스페이스 정렬 미확인

### 열린 질문

1. Evidence 품질 편차 — WebSearch 저품질 결과 필터 기준은?
2. Crux를 사용자가 못 고를 때 — 시스템 자동 선택?
3. Passive outcome skip 비율이 높을 때 — 재실행을 negative outcome으로 추론?
4. Conviction delta가 항상 0일 때 — open-ended 질문으로 대체?
5. Absence Analysis false positive — 의도적 생략 vs 진짜 전제 구분?

---

## 커밋 이력 (전체 51개, 주요만)

### 03-25
| 커밋 | 내용 |
|------|------|
| `9558c44` | feat: 의사결정 품질 측정 시스템 + 학술 기반 보상 체계 |

### 03-26
| 커밋 | 내용 |
|------|------|
| `0c9f191` | feat: Argus Claude Code plugin + web app improvements |
| `586cbf3` | feat: add install.sh — one-line installer |
| `cddab97` | feat: complete reframe redesign — web app flow + CLI design system |
| `5186c60` | feat: plugin output redesign — single-card format |
| `d2c40b7` | security: comprehensive penetration test — 37 fixes |
| `915052b` | feat: plugin flow redesign — Context Contract + v2 interview |
| `127b635` | feat: 4R framework unification + metacognitive reward system |

### 03-28
| 커밋 | 내용 |
|------|------|
| `0d02036` | test: 292 new tests + fix DQ cache + fix safeCompare bypass |
| `1fffc67` | test: 93 more tests — api-security, outcome-tracker |
| `b8426df` | feat: skill quality eval framework v1 |
| `301c95b` | refactor: eval v2 — 69→33 + exemplar-based LLM judge |
| `2d0ad7a` | feat: Judgment Vitality Engine |
| `ad5d0bb` | feat: pipeline overhaul — agent-like behavior, card redesign |
| `2009235` | docs: plugin critique & improvement roadmap + vitality engine spec |
