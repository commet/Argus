# Argus Agent System — 구현 현황 및 잔여 과제

> 2026-04-03 기준. 이 문서는 에이전트 시스템의 중심 문서입니다.

---

## 1. 아키텍처 요약

```
사용자 입력 → [지휘자: 태스크 분해] → [에이전트 배정] → [병렬 실행] → [결과 조합]
                    ↑                        ↑                 ↑
            해금된 에이전트 목록       키워드 매칭 +         XP 적립 +
            기반 팀 구성 인식          레벨 우선 배정        observation 축적
```

**핵심 설계 원칙:**
- localStorage first, Supabase async — 오프라인에서도 동작
- 모든 에이전트 Lv.1 시작, XP 누적으로 성장
- 체인 에이전트(리서치, 전략)는 해금 시스템, 독립 에이전트는 처음부터 사용 가능
- 프롬프트 차별화: 14개 에이전트 각각 고유 스킬셋 (frameworks, checkpoints, outputFormat, levelPrompts)

---

## 2. 에이전트 전체 구성 (14명 + 지휘자)

### 체인 에이전트 — 같은 분야, 깊이가 다른 별개 인물

**리서치 체인** (`chain_id: 'research'`):

| ID | 이름 | 역할 | 해금 조건 | capabilities | 핵심 차별점 |
|----|------|------|----------|--------------|------------|
| `hayoon` | 하윤 | 리서치 인턴 | 항상 | task, web_search | 사실 수집, 번호 목록, 출처 명시 |
| `sujin` | 수진 | 리서치 애널리스트 | 리서치 5회 | task, web_search | 패턴 분석, 교차 검증, "그래서 뭘 뜻하는지" |
| `research_director` | 도윤 | 리서치 디렉터 | 리서치 15회 | task, review, web_search | 교차 인사이트 도출, 전략적 함의 |

**전략 체인** (`chain_id: 'strategy'`):

| ID | 이름 | 역할 | 해금 조건 | capabilities | 핵심 차별점 |
|----|------|------|----------|--------------|------------|
| `strategy_jr` | 지호 | 전략 주니어 | 항상 | task | 비교 매트릭스, SWOT, 빈칸 없는 표 |
| `hyunwoo` | 현우 | 전략가 | 전략 5회 | task | 큰 그림, 한 줄 설득, 권장안 명시 |
| `chief_strategist` | 승현 | 수석 전략가 | 전략 15회 | task, review | 시나리오 플래닝, 의사결정 구조, 전환 트리거 |

### 독립 에이전트 — 각자 다른 전문 분야, 처음부터 사용 가능

**실행 그룹** (`group: 'production'`):

| ID | 이름 | 역할 | 핵심 차별점 |
|----|------|------|------------|
| `seoyeon` | 서연 | 카피라이터 | 첫 문장이 핵심, 한 문장 = 한 메시지, 바로 사용 가능한 문서 |
| `minjae` | 민재 | 숫자 분석가 | 숫자 먼저 → 해석, 표 적극 활용, 단위/시점 명시 |
| `junseo` | 준서 | 기술 설계자 | 구현 가능성 최우선, 트레이드오프 명시, 추천안 → 대안 |
| `yerin` | 예린 | PM | 담당자+기한 필수, 의존성/병목 표시, 다음 단계 포함 |

**검증 그룹** (`group: 'validation'`):

| ID | 이름 | 역할 | capabilities | 핵심 차별점 |
|----|------|------|-------------|------------|
| `donghyuk` | 동혁 | 리스크 검토자 | task, review | "왜 실패하는지"부터, 리스크마다 완화 방안 |
| `jieun` | 지은 | UX 설계자 | task, review | 실제 사용자 한 명 상상, 구체적 시나리오 |
| `taejun` | 태준 | 법률 검토자 | task, review | 가능/불가능 먼저, 법적 근거 명시 |

### 특수 에이전트

| ID | 이름 | 역할 | 해금 조건 | 핵심 차별점 |
|----|------|------|----------|------------|
| `concertmaster` | 악장 | Concertmaster | 전체 작업 30회 | 에이전트 간 모순 탐지, 빠진 관점 지적, 메타 리뷰 |

### 지휘자 (Conductor)

코드 로직으로 존재 (별도 Agent 객체 아님). `buildDeepeningPrompt()`에서 해금된 에이전트 목록을 LLM에 전달 → 팀 구성 고려한 execution_plan 생성.

### Boss / Stakeholder 에이전트

`origin: 'boss_sim'` 또는 `origin: 'stakeholder'`로 사용자가 생성. `group: 'people'`.

---

## 3. 레벨 & XP 시스템

| Lv | 필요 XP | 프롬프트 변화 |
|----|---------|-------------|
| 1 | 0 | 기본 expertise + tone + 스킬셋 frameworks/checkpoints |
| 2 | 100 | + observation 최대 3개 주입 |
| 3 | 300 | + observation 5개 |
| 4 | 600 | 전체 observation, gold 뱃지 |
| 5 | 1000 | 전체 + guru 레벨 프롬프트 |

**XP 획득:**

| 이벤트 | XP | 구현 상태 |
|--------|-----|----------|
| 작업 완료 (task_completed) | +15 | **구현됨** — worker-engine.ts |
| 사용자 승인 (task_approved) | +10 | **구현됨** — useProgressiveStore |
| 사용자 거부 (task_rejected) | -5 | **구현됨** — useProgressiveStore |
| 리뷰 수행 (review_given) | +20 | **구현됨** — 호출 경로 존재 |
| 리뷰 정확도 높음 (review_accurate) | +15 | **구현됨** — 호출 경로 존재 |
| Boss 대화 (boss_chat) | +5 | **미구현** — commitAssistantMessage에서 미호출 |

**레벨 → AgentLevel 매핑** (`numericLevelToAgentLevel`):
- Lv.1~2 → junior (maxTokens: 800)
- Lv.3~4 → senior (maxTokens: 1500)
- Lv.5 → guru (maxTokens: 2500)

---

## 4. 해금 시스템

| 대상 | 조건 타입 | 필요 수 | 구현 상태 |
|------|----------|---------|----------|
| 수진, 현우 | chain_tasks | 5 | **구현됨** |
| 도윤, 승현 | chain_tasks | 15 | **구현됨** |
| 악장 | total_tasks | 30 | **구현됨** |
| UnlockToast 알림 | — | — | **구현됨** |

`checkUnlocks()` → `lastUnlockedIds` 상태 → UnlockToast 컴포넌트 (Providers.tsx에 마운트).

---

## 5. 구현 완료 항목

### 5-1. 타입 & 스토어

| 파일 | 역할 |
|------|------|
| `src/stores/agent-types.ts` | Agent, AgentChain, AgentObservation, AgentActivity 타입 + 레벨/XP 계산 |
| `src/stores/useAgentStore.ts` | 중앙 스토어 — CRUD, 배정, XP, 해금, seed, migration, Supabase sync |
| `src/lib/agent-adapters.ts` | Agent ↔ WorkerPersona ↔ Persona 양방향 변환 |
| `src/lib/storage.ts` | AGENTS, AGENT_CHAINS, AGENT_ACTIVITIES 스토리지 키 |
| `src/stores/types.ts` | WorkerTask에 `agent_id?: string` 추가 |

### 5-2. 프롬프트 & 스킬

| 파일 | 역할 |
|------|------|
| `src/lib/agent-skills.ts` | 14개 에이전트 스킬셋 + AGENT_ID_TO_SKILL 매핑 |
| `src/lib/agent-prompt-builder.ts` | `buildAgentContext()` — 레벨별 observation 주입 (Lv.2+) |
| `src/lib/progressive-prompts.ts` | `buildWorkerTaskPrompt()` — agent 파라미터, effectiveLevel 반영 |
| `src/lib/progressive-engine.ts` | `runDeepening()` — 내부에서 availableAgents 조회 → 지휘자 팀 인식 |
| `src/lib/persona-prompt.ts` | `buildFeedbackSystemPromptFromAgent()` — rehearsal용 agent 프롬프트 |
| `src/lib/boss/boss-prompt.ts` | `buildBossSystemPromptFromAgent()` — boss agent용 프롬프트 |

### 5-3. Progressive Flow 연동

| 파일 | 변경 |
|------|------|
| `src/stores/useProgressiveStore.ts` | `initWorkers()` → agent store 배정, approve/reject → XP 기록, 에이전트 레벨 반영 |
| `src/lib/worker-engine.ts` | agent 조회 → 스킬 적용 → 웹 검색 → activity 기록 |

### 5-4. Boss 연동

| 파일 | 변경 |
|------|------|
| `src/stores/useBossStore.ts` | `saveAsAgent()`, `loadBossFromAgent()`, `loadedAgentId` |
| `src/components/boss/BossChat.tsx` | 저장 버튼, `loadedAgentId` 시 `buildBossSystemPromptFromAgent` 사용 |
| `src/app/boss/page.tsx` | SavedBossList — 저장된 boss 목록 + 재진입 |

### 5-5. Rehearsal 연동

| 파일 | 변경 |
|------|------|
| `src/components/workspace/RehearseStep.tsx` | persona.id로 agent 조회 → agent 있으면 `buildFeedbackSystemPromptFromAgent` |
| `src/components/workspace/RefineStep.tsx` | re-review 시 동일하게 agent 프롬프트 우선 |

### 5-6. Persona 호환

| 파일 | 변경 |
|------|------|
| `src/stores/usePersonaStore.ts` | `getPersona()` agent fallthrough, `createPersona()` agent 동시 생성, `loadData()` agent people 합침 |

### 5-7. UI

| 파일 | 역할 |
|------|------|
| `src/app/agents/page.tsx` | /agents 허브 페이지 |
| `src/components/agents/AgentHub.tsx` | 체인 → 실행 → 검증 → 사람들 → 특수 순 렌더 |
| `src/components/agents/AgentCard.tsx` | emoji, 역할, Lv, XP bar, 잠금 상태 |
| `src/components/agents/AgentProfile.tsx` | 상세 모달 — 레벨, XP, observations, 통계 |
| `src/components/agents/UnlockToast.tsx` | 해금 알림 토스트 (Framer Motion) |
| `src/components/layout/Header.tsx` | '에이전트' 네비게이션 링크 |
| `src/components/layout/Providers.tsx` | UnlockToast 글로벌 마운트 |
| WorkerCard/WorkerPanel | 레벨 뱃지 (Lv.2+만 표시) |

### 5-8. 인프라

| 파일 | 역할 |
|------|------|
| `src/app/api/search/route.ts` | Brave Search API 프록시 (/api/search) |
| `src/lib/db.ts` | TableName에 agents/agent_chains/agent_activities 추가 |
| `supabase/migrations/20260403_agents.sql` | 3개 테이블 + RLS + triggers |
| `src/app/globals.css` | agent-hub, agent-card, unlock-toast CSS |

### 5-9. 안전성

| 항목 | 내용 |
|------|------|
| `createAgent()` 중복 ID 가드 | 같은 ID로 재생성 방지 |
| `personaToAgentInput()` ID 전달 | 마이그레이션 시 persona.id 유지 |
| `assignPersona()` 제거 | 미사용 deprecated 함수 삭제 |

---

## 6. 미구현 항목 — 완벽을 위해 남은 것

### ~~6-1. Observation 자동 생성~~ → 구현 완료 (2026-04-04)

`src/lib/observation-engine.ts` 생성:
- 규칙 기반: 승인 3회 → 선호도 observation, 거부 2회 → 톤 조정 observation, 도메인 키워드 추출
- LLM 배치: 에이전트당 5회마다 비동기 분석 (maxTokens: 150, 비차단)
- `useProgressiveStore`의 approve/reject에서 자동 트리거

### ~~6-2. Boss 대화 XP 기록~~ → 구현 완료 (2026-04-04)

`useBossStore.ts` `commitAssistantMessage()`에 `recordActivity('boss_chat')` 추가.

### ~~6-3. 악장(Concertmaster) 실제 호출~~ → 구현 완료 (2026-04-04)

- `buildConcertmasterReviewPrompt()` — 전체 결과물 대상 모순/빈틈/품질 판단 프롬프트
- `runConcertmasterReview()` — 악장 해금 시만 실행, review_given XP 적립
- `ProgressiveFlow.tsx` MixPreview — "악장의 한마디" UI 섹션 (Mix 직전 비동기 호출)

### 6-4. Supabase 테이블 실제 생성

**현재:** `supabase/migrations/20260403_agents.sql` 파일만 존재. 실제 DB에 미적용.

**수행:** Supabase 대시보드 SQL Editor에서 실행, 또는 MCP `apply_migration` 사용.

### 6-5. 웹 검색 API 키 설정

**현재:** `BRAVE_SEARCH_API_KEY` 환경변수 미설정 → 검색 기능 비활성.

**수행:** [Brave Search API](https://api.search.brave.com/) 무료 키 발급 → `.env.local`에 추가.

### 6-6. 지휘자 LLM 승격

**현재:** 코드 로직 (`assignAgentToTask` 키워드 매칭). 지휘자가 팀 목록을 "보기"는 하지만 직접 배정하지는 않음.

**향후:** 별도 LLM 호출로 "이 문제에 누구를 투입하고 각자 뭘 하게 할지" 결정. 현재 키워드 매칭은 fallback으로 유지.

### 6-7. 프롬프트 차별화 심화

**현재:** 14개 에이전트 각각 고유 스킬셋 + 3단계 levelPrompts.

**향후:** 체인 에이전트별 전문 방법론 주입 (예: 리서치 디렉터에게 특정 분석 프레임워크, 수석 전략가에게 게임이론 등). 현재는 일반적 수준.

---

## 7. 파일 맵

```
src/
├── stores/
│   ├── agent-types.ts          # Agent, AgentChain, AgentObservation 타입
│   ├── useAgentStore.ts        # 중앙 스토어 (CRUD, XP, 해금, seed)
│   ├── useProgressiveStore.ts  # initWorkers → agent 배정, approve/reject → XP
│   ├── useBossStore.ts         # saveAsAgent, loadBossFromAgent
│   └── usePersonaStore.ts      # agent 호환 레이어
├── lib/
│   ├── agent-adapters.ts       # Agent ↔ WorkerPersona ↔ Persona
│   ├── agent-prompt-builder.ts # buildAgentContext (Lv.2+ observation)
│   ├── agent-skills.ts         # 14개 스킬셋 + ID 매핑
│   ├── worker-engine.ts        # runWorkerTask (agent 조회, 검색, XP)
│   ├── worker-personas.ts      # 구 시스템 (getCompletionNote만 사용)
│   ├── progressive-prompts.ts  # buildWorkerTaskPrompt (agent 우선)
│   ├── progressive-engine.ts   # runDeepening (지휘자 에이전트 인식)
│   ├── persona-prompt.ts       # buildFeedbackSystemPromptFromAgent
│   ├── boss/boss-prompt.ts     # buildBossSystemPromptFromAgent
│   └── storage.ts              # AGENTS, AGENT_CHAINS, AGENT_ACTIVITIES 키
├── components/
│   ├── agents/
│   │   ├── AgentHub.tsx        # /agents 허브
│   │   ├── AgentCard.tsx       # 에이전트 카드
│   │   ├── AgentProfile.tsx    # 에이전트 상세 모달
│   │   └── UnlockToast.tsx     # 해금 알림
│   ├── boss/BossChat.tsx       # agent 프롬프트 연동
│   ├── workspace/
│   │   ├── RehearseStep.tsx    # agent 프롬프트 우선
│   │   └── RefineStep.tsx      # agent 프롬프트 우선
│   └── layout/
│       ├── Header.tsx          # /agents 네비게이션
│       └── Providers.tsx       # UnlockToast 마운트
├── app/
│   ├── agents/page.tsx         # /agents 라우트
│   ├── api/search/route.ts     # Brave Search 프록시
│   └── boss/page.tsx           # SavedBossList
└── hooks/
    └── useWorkerActions.ts     # approve/reject 훅

supabase/
└── migrations/
    └── 20260403_agents.sql     # agents, agent_chains, agent_activities + RLS
```

---

## 8. 우선순위 정리

| 순위 | 항목 | 상태 | 난이도 |
|------|------|------|--------|
| ~~1~~ | ~~Observation 자동 생성~~ | **완료** | ~~중~~ |
| ~~2~~ | ~~Boss 대화 XP 기록~~ | **완료** | ~~하~~ |
| ~~3~~ | ~~악장 메타 리뷰 호출~~ | **완료** | ~~중~~ |
| 4 | Supabase 마이그레이션 적용 | SQL 실행만 하면 됨 | 하 |
| 5 | 검색 API 키 설정 | 환경변수 추가 | 하 |
| 6 | 지휘자 LLM 승격 | 현재 키워드 매칭도 충분히 작동 | 상 |
| 7 | 프롬프트 심화 | 현재 수준도 차별화 있음 | 중 |
